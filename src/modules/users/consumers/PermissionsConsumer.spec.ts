import type { Cradle } from '@fastify/awilix'
import { waitAndRetry } from '@message-queue-toolkit/core'
import type { PrismaClient } from '@prisma/client'
import type { Channel } from 'amqplib'
import type { AwilixContainer } from 'awilix'
import { asClass } from 'awilix'
import type { FastifyInstance } from 'fastify'

import { cleanTables, DB_MODEL } from '../../../../test/DbCleaner'
import { FakeConsumerErrorResolver } from '../../../../test/fakes/FakeConsumerErrorResolver'
import { getApp } from '../../../app'
import { SINGLETON_CONFIG } from '../../../infrastructure/diConfig'
import { buildQueueMessage } from '../../../utils/queueUtils'
import type { PermissionsService } from '../services/PermissionsService'

import { PermissionConsumer } from './PermissionConsumer'
import type { PERMISSIONS_ADD_MESSAGE_TYPE } from './userConsumerSchemas'

const userIds = [100, 200, 300]
const perms: [string, ...string[]] = ['perm1', 'perm2']

async function createUsers(prisma: PrismaClient, userIdsToCreate: number[]) {
  await prisma.user.createMany({
    data: userIdsToCreate.map((userId) => {
      return {
        id: userId,
        name: userId.toString(),
        email: `test${userId}@email.lt`,
      }
    }),
  })
}

async function resolvePermissions(permissionsService: PermissionsService, userIds: number[]) {
  const usersPerms = await permissionsService.getUserPermissionsBulk(userIds)

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
    let app: FastifyInstance
    let diContainer: AwilixContainer<Cradle>
    let consumer: PermissionConsumer
    let channel: Channel
    beforeEach(async () => {
      app = await getApp(
        {
          queuesEnabled: [PermissionConsumer.QUEUE_NAME],
        },
        {
          consumerErrorResolver: asClass(FakeConsumerErrorResolver, SINGLETON_CONFIG),
        },
      )
      diContainer = app.diContainer

      channel = await (
        await app.diContainer.cradle.amqpConnectionManager.getConnection()
      ).createChannel()
      await cleanTables(diContainer.cradle.prisma, [DB_MODEL.User])
      await app.diContainer.cradle.permissionsService.deleteAll()
      consumer = app.diContainer.cradle.permissionConsumer
    })

    afterEach(async () => {
      await channel.close()
      await app.close()
    })

    it('Creates permissions', async () => {
      const { userService, permissionsService, prisma } = diContainer.cradle
      const users = await userService.getUsers(userIds)
      expect(users).toHaveLength(0)

      await createUsers(prisma, userIds)

      void channel.sendToQueue(
        PermissionConsumer.QUEUE_NAME,
        buildQueueMessage({
          id: 'abc',
          messageType: 'add',
          userIds,
          permissions: perms,
        } satisfies PERMISSIONS_ADD_MESSAGE_TYPE),
      )

      const messageResult = await consumer.handlerSpy.waitForMessageWithId('abc')
      expect(messageResult.processingResult).toBe('consumed')
      const usersPermissions = await resolvePermissions(permissionsService, userIds)

      if (null === usersPermissions) {
        throw new Error('Users permissions unexpectedly null')
      }

      expect(usersPermissions).toBeDefined()
      expect(usersPermissions[0]).toHaveLength(2)
    })

    it('Wait for users to be created and then create permissions', async () => {
      const { userService, permissionsService, prisma } = diContainer.cradle
      const users = await userService.getUsers(userIds)
      expect(users).toHaveLength(0)

      channel.sendToQueue(
        PermissionConsumer.QUEUE_NAME,
        buildQueueMessage({
          id: 'def',
          userIds,
          messageType: 'add',
          permissions: perms,
        } satisfies PERMISSIONS_ADD_MESSAGE_TYPE),
      )

      const messageResult = await consumer.handlerSpy.waitForMessageWithId('def')
      expect(messageResult.processingResult).toBe('retryLater')

      // no users in the database, so message will go back to the queue
      const usersFromDb = await resolvePermissions(permissionsService, userIds)
      expect(usersFromDb).toBeNull()

      await createUsers(prisma, userIds)
      await consumer.handlerSpy.waitForMessageWithId('def', 'consumed')
      const usersPermissions = await resolvePermissions(permissionsService, userIds)

      if (null === usersPermissions) {
        throw new Error('Users permissions unexpectedly null')
      }

      expect(usersPermissions).toBeDefined()
      expect(usersPermissions[0]).toHaveLength(2)
    })

    it('Not all users exist, no permissions were created', async () => {
      const { userService, permissionsService, prisma } = diContainer.cradle
      const users = await userService.getUsers(userIds)
      expect(users).toHaveLength(0)

      const partialUsers = [...userIds]
      const missingUser = partialUsers.pop()
      await createUsers(prisma, partialUsers)

      channel.sendToQueue(
        PermissionConsumer.QUEUE_NAME,
        buildQueueMessage({
          id: 'abcdef',
          userIds,
          messageType: 'add',
          permissions: perms,
        } satisfies PERMISSIONS_ADD_MESSAGE_TYPE),
      )

      const messageResult = await consumer.handlerSpy.waitForMessageWithId('abcdef', 'retryLater')
      expect(messageResult.processingResult).toBe('retryLater')

      // not all users are in the database, so message will go back to the queue
      const usersFromDb = await resolvePermissions(permissionsService, userIds)
      expect(usersFromDb).toBeNull()

      await createUsers(prisma, [missingUser!])

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

      channel.sendToQueue(
        PermissionConsumer.QUEUE_NAME,
        buildQueueMessage({
          id: 'errorMessage',
          messageType: 'add',
          permissions: perms,
        }),
      )

      const fakeResolver = consumerErrorResolver as FakeConsumerErrorResolver
      // even though we are failing at validating the message, we can still extract an id out of, as it's a valid json
      const messageResult = await consumer.handlerSpy.waitForMessage({
        id: 'errorMessage',
      })
      expect(messageResult.processingResult).toBe('invalid_message')

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
  })
})
