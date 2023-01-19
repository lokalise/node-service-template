import { diContainer } from '@fastify/awilix'
import type { PrismaClient } from '@prisma/client'
import type { Channel } from 'amqplib'
import { asClass } from 'awilix'
import type { FastifyInstance } from 'fastify'

import { cleanTables, DB_MODEL } from '../../../../test/DbCleaner'
import { FakeConsumerErrorResolver } from '../../../../test/fakes/FakeConsumerErrorResolver'
import { waitAndRetry } from '../../../../test/utils/waitUtils'
import { getApp } from '../../../app'
import { SINGLETON_CONFIG } from '../../../infrastructure/diConfig'
import { buildQueueMessage } from '../../../utils/queueUtils'
import type { PermissionsService } from '../services/PermissionsService'

import { PermissionConsumer } from './PermissionConsumer'
import type { PERMISSIONS_MESSAGE_TYPE } from './userConsumerSchemas'

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

async function waitForPermissions(permissionsService: PermissionsService, userIds: number[]) {
  return await waitAndRetry(
    async () => {
      const usersPerms = await permissionsService.getUserPermissionsBulk(userIds)

      if (usersPerms && usersPerms.length !== userIds.length) {
        return null
      }

      for (const userPerms of usersPerms)
        if (userPerms.length !== perms.length) {
          return null
        }

      return usersPerms
    },
    500,
    5,
  )
}

describe('PermissionsConsumer', () => {
  describe('consume', () => {
    let app: FastifyInstance
    let channel: Channel
    beforeAll(async () => {
      app = await getApp(
        {
          amqpEnabled: true,
        },
        {
          consumerErrorResolver: asClass(FakeConsumerErrorResolver, SINGLETON_CONFIG),
        },
      )
    })

    beforeEach(async () => {
      await cleanTables(diContainer.cradle.prisma, [DB_MODEL.User])
      await app.diContainer.cradle.permissionsService.deleteAll()
      channel = await app.diContainer.cradle.amqpConnection.createChannel()
      await app.diContainer.cradle.permissionConsumer.consume()
    })

    afterEach(async () => {
      await channel.deleteQueue(PermissionConsumer.QUEUE_NAME)
      await channel.close()
    })

    afterAll(async () => {
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
          messageType: 'add',
          userIds,
          permissions: perms,
        } satisfies PERMISSIONS_MESSAGE_TYPE),
      )

      const usersPermissions = await waitForPermissions(permissionsService, userIds)

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
          userIds,
          messageType: 'add',
          permissions: perms,
        } satisfies PERMISSIONS_MESSAGE_TYPE),
      )

      // no users in the database, so message will go back to the queue
      const usersFromDb = await waitForPermissions(permissionsService, userIds)
      expect(usersFromDb).toBeNull()

      await createUsers(prisma, userIds)

      const usersPermissions = await waitForPermissions(permissionsService, userIds)

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
          userIds,
          messageType: 'add',
          permissions: perms,
        } satisfies PERMISSIONS_MESSAGE_TYPE),
      )

      // not all users are in the database, so message will go back to the queue
      const usersFromDb = await waitForPermissions(permissionsService, userIds)
      expect(usersFromDb).toBeNull()

      await createUsers(prisma, [missingUser!])

      const usersPermissions = await waitForPermissions(permissionsService, userIds)

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
          messageType: 'add',
          permissions: perms,
        } as PERMISSIONS_MESSAGE_TYPE),
      )

      const fakeResolver = consumerErrorResolver as FakeConsumerErrorResolver
      await waitAndRetry(() => fakeResolver.handleErrorCallsCount, 500, 5)

      expect(fakeResolver.handleErrorCallsCount).toBe(1)
    })

    it('Non-JSON message in the queue', async () => {
      const { consumerErrorResolver } = diContainer.cradle

      channel.sendToQueue(PermissionConsumer.QUEUE_NAME, Buffer.from('dummy'))

      const fakeResolver = consumerErrorResolver as FakeConsumerErrorResolver
      await waitAndRetry(() => fakeResolver.handleErrorCallsCount, 500, 5)

      expect(fakeResolver.handleErrorCallsCount).toBe(1)
    })
  })
})
