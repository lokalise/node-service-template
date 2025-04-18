import type { Cradle } from '@fastify/awilix'
import { type MessagePublishType, waitAndRetry } from '@message-queue-toolkit/core'
import type { Channel } from 'amqplib'
import type { AwilixContainer } from 'awilix'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DB_MODEL, cleanTables } from '../../../../test/DbCleaner.ts'
import { FakeConsumerErrorResolver } from '../../../../test/fakes/FakeConsumerErrorResolver.ts'
import { createRequestContext } from '../../../../test/requestUtils.ts'
import type { AppInstance } from '../../../app.ts'
import { getApp } from '../../../app.ts'
import type { PermissionsService } from '../services/PermissionsService.ts'

import { generateUuid7 } from '@lokalise/id-utils'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import { asSingletonClass } from 'opinionated-machine'
import { user as userTable } from '../../../db/schema/user.ts'
import type { PublisherManager } from '../../../infrastructure/CommonModule.ts'
import { buildQueueMessage } from '../../../utils/queueUtils.ts'
import { PermissionConsumer } from './PermissionConsumer.ts'
import type { PermissionsMessages } from './permissionsMessageSchemas.ts'

const userIds = [generateUuid7(), generateUuid7(), generateUuid7()]
const perms: [string, ...string[]] = ['perm1', 'perm2']
const testRequestContext = createRequestContext()

async function createUsers(drizzle: PostgresJsDatabase, userIdsToCreate: string[]) {
  await drizzle.insert(userTable).values(
    userIdsToCreate.map((userId) => {
      return {
        id: userId,
        name: userId.toString(),
        email: `test${userId}@email.lt`,
      }
    }),
  )
}

async function resolvePermissions(permissionsService: PermissionsService, userIds: string[]) {
  const usersPerms = await permissionsService.getUserPermissionsBulk(testRequestContext, userIds)

  if (usersPerms && usersPerms.length !== userIds.length) {
    return null
  }

  for (const userPerms of usersPerms)
    if (userPerms.length !== perms.length) {
      return null
    }

  return usersPerms
}

describe('PermissionsConsumer', () => {
  describe('consume', () => {
    let app: AppInstance
    let diContainer: AwilixContainer<Cradle>
    let consumer: PermissionConsumer
    let publisher: PublisherManager
    let channel: Channel
    beforeEach(async () => {
      app = await getApp(
        {
          messageQueueConsumersEnabled: [PermissionConsumer.QUEUE_NAME],
          monitoringEnabled: true,
        },
        {
          consumerErrorResolver: asSingletonClass(FakeConsumerErrorResolver),
        },
      )
      diContainer = app.diContainer

      const connection = await app.diContainer.cradle.amqpConnectionManager.getConnection()

      channel = await connection.createChannel()
      await cleanTables(diContainer.cradle.drizzle, [DB_MODEL.User])
      await app.diContainer.cradle.permissionsService.deleteAll(testRequestContext)
      consumer = app.diContainer.cradle.permissionConsumer
      publisher = app.diContainer.cradle.publisherManager
    })

    afterEach(async () => {
      await channel.close()
      await app.close()
    })

    it('Creates permissions', async () => {
      const { userService, permissionsService, drizzle } = diContainer.cradle
      const users = await userService.getUsers(testRequestContext, userIds)
      expect(users).toHaveLength(0)

      await createUsers(drizzle, userIds)

      publisher.publishSync('permissions', {
        id: 'abc',
        payload: {
          userIds,
          permissions: perms,
        },
        type: 'permissions.added',
      })

      const messageResult = await consumer.handlerSpy.waitForMessageWithId('abc')
      expect(messageResult.processingResult).toEqual({
        status: 'consumed',
      })
      const usersPermissions = await resolvePermissions(permissionsService, userIds)

      if (null === usersPermissions) {
        throw new Error('Users permissions unexpectedly null')
      }

      expect(usersPermissions).toBeDefined()
      expect(usersPermissions[0]).toHaveLength(2)
    })

    it('Wait for users to be created and then create permissions', async () => {
      const { userService, permissionsService, drizzle } = diContainer.cradle
      const users = await userService.getUsers(testRequestContext, userIds)
      expect(users).toHaveLength(0)

      publisher.publishSync('permissions', {
        id: 'def',
        type: 'permissions.added',
        payload: {
          userIds,
          permissions: perms,
        },
      })

      const messageResult = await consumer.handlerSpy.waitForMessageWithId('def')
      expect(messageResult.processingResult).toEqual({
        status: 'retryLater',
      })

      // no users in the database, so message will go back to the queue
      const usersFromDb = await resolvePermissions(permissionsService, userIds)
      expect(usersFromDb).toBeNull()

      await createUsers(drizzle, userIds)
      await consumer.handlerSpy.waitForMessageWithId('def', 'consumed')
      const usersPermissions = await resolvePermissions(permissionsService, userIds)

      if (null === usersPermissions) {
        throw new Error('Users permissions unexpectedly null')
      }

      expect(usersPermissions).toBeDefined()
      expect(usersPermissions[0]).toHaveLength(2)
    })

    it('Not all users exist, no permissions were created', async () => {
      const { userService, permissionsService, drizzle } = diContainer.cradle
      const users = await userService.getUsers(testRequestContext, userIds)
      expect(users).toHaveLength(0)

      const partialUsers = [...userIds]
      const missingUser = partialUsers.pop()
      await createUsers(drizzle, partialUsers)

      publisher.publishSync('permissions', {
        id: 'abcdef',
        payload: {
          userIds,
          permissions: perms,
        },
        type: 'permissions.added',
      })

      const messageResult = await consumer.handlerSpy.waitForMessageWithId('abcdef', 'retryLater')
      expect(messageResult.processingResult).toEqual({
        status: 'retryLater',
      })

      // not all users are in the database, so message will go back to the queue
      const usersFromDb = await resolvePermissions(permissionsService, userIds)
      expect(usersFromDb).toBeNull()

      await createUsers(drizzle, [missingUser!])

      await consumer.handlerSpy.waitForMessageWithId('abcdef', 'consumed')
      const usersPermissions = await resolvePermissions(permissionsService, userIds)

      if (null === usersPermissions) {
        throw new Error('Users permissions unexpectedly null')
      }

      expect(usersPermissions).toBeDefined()
      expect(usersPermissions[0]).toHaveLength(2)
    })

    it('Invalid message in the queue', async () => {
      const { consumerErrorResolver } = diContainer.cradle
      const invalidMessage = {
        id: 'errorMessage',
        payload: {
          permissions: perms,
        },
        type: 'permissions.added',
      }

      expect(() =>
        // @ts-expect-error This should be causing a compilation error
        publisher.publishSync('permissions', invalidMessage),
      ).toThrowErrorMatchingInlineSnapshot(`
        [ZodError: [
          {
            "code": "invalid_type",
            "expected": "array",
            "received": "undefined",
            "path": [
              "payload",
              "userIds"
            ],
            "message": "Required"
          }
        ]]
      `)

      channel.sendToQueue(PermissionConsumer.QUEUE_NAME, buildQueueMessage(invalidMessage))

      const fakeResolver = consumerErrorResolver as FakeConsumerErrorResolver
      // even though we are failing at validating the message, we can still extract an id out of, as it's a valid json
      const messageResult = await consumer.handlerSpy.waitForMessage({
        id: 'errorMessage',
      })
      expect(messageResult.processingResult).toEqual({
        errorReason: 'invalidMessage',
        status: 'error',
      })

      expect(fakeResolver.handleErrorCallsCount).toBe(1)
    })

    it('Non-JSON message in the queue', async () => {
      const { consumerErrorResolver } = diContainer.cradle

      channel.sendToQueue(PermissionConsumer.QUEUE_NAME, Buffer.from('dummy'))

      const fakeResolver = consumerErrorResolver as FakeConsumerErrorResolver
      // can't await by id, there is no resolveable id in this message
      await waitAndRetry(() => fakeResolver.handleErrorCallsCount)

      // We fail first when doing real reading, and second one when trying to extract an id
      expect(fakeResolver.handleErrorCallsCount).toBe(2)
    })

    it('Registers message processing metrics', async () => {
      // Given
      const { permissionsService, drizzle } = diContainer.cradle
      await createUsers(drizzle, userIds)

      expect(diContainer.cradle.messageProcessingMetricsManager).toBeDefined()
      const metricsSpy = vi.spyOn(
        diContainer.cradle.messageProcessingMetricsManager!,
        'registerProcessedMessage',
      )

      // When
      const messageId = 'testId'
      const message = {
        id: messageId,
        payload: {
          userIds,
          permissions: perms,
        },
        type: 'permissions.added',
      } satisfies MessagePublishType<typeof PermissionsMessages.added>
      publisher.publishSync('permissions', message)

      // Then
      await consumer.handlerSpy.waitForMessageWithId(messageId, 'consumed')

      const usersPermissions = await resolvePermissions(permissionsService, userIds)

      expect(usersPermissions).toBeDefined()
      expect(usersPermissions).not.toBeNull()
      expect(usersPermissions![0]).toHaveLength(2)

      expect(metricsSpy).toHaveBeenCalledWith({
        messageId: messageId,
        messageType: 'permissions.added',
        processingResult: {
          status: 'consumed',
        },
        message: expect.objectContaining(message),
        queueName: PermissionConsumer.QUEUE_NAME,
        messageTimestamp: expect.any(Number),
        messageProcessingStartTimestamp: expect.any(Number),
        messageProcessingEndTimestamp: expect.any(Number),
      })
    })
  })
})
