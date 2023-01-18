import { diContainer } from '@fastify/awilix'
import type { Channel } from 'amqplib'
import { asClass } from 'awilix'
import type { FastifyInstance } from 'fastify'

import { FakeConsumerErrorResolver } from '../../../../test/fakes/FakeConsumerErrorResolver'
import { getApp } from '../../../app'
import { SINGLETON_CONFIG } from '../../../infrastructure/diConfig'
import { buildQueueMessage } from '../../../utils/queueMessage.util'
import { waitAndRetry } from '../../../utils/wait.util'

import { PermissionConsumer } from './PermissionConsumer'
import { cleanTables, DB_MODEL } from "../../../../test/DbCleaner";
import { PERMISSIONS_MESSAGE_TYPE } from "./userConsumerSchemas";

const userIds: [number, ...number[]] = [100, 200, 300]

describe('PermissionsConsumer', () => {
  describe('consume', () => {
    let app: FastifyInstance
    let channel: Channel
    beforeAll(async () => {
      app = await getApp(
        {},
        {
          consumerErrorResolver: asClass(FakeConsumerErrorResolver, SINGLETON_CONFIG),
        },
      )

      await cleanTables(diContainer.cradle.prisma, [DB_MODEL.User])
      channel = await app.diContainer.cradle.amqpConnection.createChannel()
    })

    afterAll(async () => {
      await channel.deleteQueue(PermissionConsumer.QUEUE_NAME)
      await channel.close()

      await app.close()
    })

    it('Creates permissions', async () => {
      const { userService, permissionService, prisma } = diContainer.cradle
      const users = await userService.getUsers(userIds, projectId)
      expect(users).toHaveLength(0)

      // let's create users
      const usersToCreate = userIds.map((userId: number) => {
        return {
          lokaliseUserId: userId,
          lokaliseProjectId: projectId,
        }
      })

      await prisma.user.createMany({
        data:  userIds.map((userId) => {
          return {
            id: userId,
            name: userId.toString(),
            email: 'test@email.lt'
          }
        })
      })

      void channel.sendToQueue(
        PermissionConsumer.QUEUE_NAME,
        buildQueueMessage({
          operation: 'add',
          userIds,
          permissions: ['some perm'],
        } satisfies PERMISSIONS_MESSAGE_TYPE),
      )

      const createdUsersArray = await userService.getUsers(userIds)
      const usersPermissions = await waitAndRetry(
        async () => {
          const users = await permissionService.getUserPermissionsBulk(
            createdUsersArray.map((user) => user.id),
          )

          if (users && users.length !== createdUsersArray.length) {
            return null
          }

          for (const user of users)
            if (
              user.ProjectUserKey.length !== keyIds.length ||
              user.UserProjectLanguage.length !== langIds.length
            ) {
              return null
            }

          return users
        },
        500,
        5,
      )

      if (null === usersPermissions) {
        throw new Error('Users permissions unexpectedly null')
      }

      expect(usersPermissions).toBeDefined()
      expect(usersPermissions[0].ProjectUserKey).toHaveLength(3)
      expect(usersPermissions[0].UserProjectLanguage).toHaveLength(2)
    })

    it('Wait for users to be created and then create permissions', async () => {
      const { userService, permissionService } = diContainer.cradle
      const users = await userService.getUsers(userIds, projectId)
      expect(users).toHaveLength(0)

      channel.sendToQueue(
        PermissionConsumer.QUEUE_NAME,
        buildQueueMessage({
          task: 'new_task',
          created: 12345,
          params: {
            projectId,
            userIds,
            keyIds,
            langIds,
          },
        } satisfies MESSAGE_SET_PERMISSIONS_TYPE),
      )

      // no users in the database, so message will go back to the queue
      const usersFromDb = await waitAndRetry(
        async () => {
          const users = await userService.getUsers(userIds, projectId)
          if (!users.length) {
            return null
          }

          return users
        },
        200,
        5,
      )
      expect(usersFromDb).toBeFalsy()

      // let's create users
      const usersToCreate = userIds.map((userId: number) => {
        return {
          lokaliseUserId: userId,
          lokaliseProjectId: projectId,
        }
      })

      await userService.createUsers(usersToCreate)
      const createdUsersArray = await userService.getUsers(userIds, projectId)
      const usersPermissions = await waitAndRetry(
        async () => {
          const users = await permissionService.getUserPermissionsBulk(
            createdUsersArray.map((user) => user.id),
          )

          if (users && users.length !== createdUsersArray.length) {
            return null
          }

          for (const user of users)
            if (
              user.ProjectUserKey.length !== keyIds.length ||
              user.UserProjectLanguage.length !== langIds.length
            ) {
              return null
            }

          return users
        },
        500,
        5,
      )

      if (null === usersPermissions) {
        throw new Error('Users permissions unexpectedly null')
      }

      expect(usersPermissions).toBeDefined()
      expect(usersPermissions[0].ProjectUserKey).toHaveLength(3)
      expect(usersPermissions[0].UserProjectLanguage).toHaveLength(2)
    })

    it.skip('Not all users exist, no permissions were created', async () => {
      const { userService, permissionService } = diContainer.cradle
      const users = await userService.getUsers(userIds, projectId)
      expect(users).toHaveLength(0)

      // let's create just one user
      const userToCreate = {
        lokaliseUserId: userIds[0],
        lokaliseProjectId: projectId,
      }

      await userService.createUser(userToCreate)

      channel.sendToQueue(
        PermissionConsumer.QUEUE_NAME,
        buildQueueMessage({
          task: 'new_task',
          created: 12345,
          params: {
            projectId,
            userIds,
            keyIds,
            langIds,
          },
        } satisfies MESSAGE_SET_PERMISSIONS_TYPE),
      )

      const createdUsersArray = await userService.getUsers(userIds, projectId)
      const usersPermissions = await waitAndRetry(
        async () => {
          const users = await permissionService.getUserPermissionsBulk(
            createdUsersArray.map((user) => user.id),
          )

          if (users && users.length !== createdUsersArray.length) {
            return null
          }

          for (const user of users)
            if (
              user.ProjectUserKey.length !== keyIds.length ||
              user.UserProjectLanguage.length !== langIds.length
            ) {
              return null
            }

          return users
        },
        500,
        5,
      )

      expect(usersPermissions).toBeFalsy()
    })

    it('Wrong message in the queue', async () => {
      const { userService, consumerErrorHandler } = diContainer.cradle

      const usersToCreate = userIds.map((userId: number) => {
        return {
          lokaliseUserId: userId,
          lokaliseProjectId: projectId,
        }
      })

      await userService.createUsers(usersToCreate)

      channel.sendToQueue(
        PermissionConsumer.QUEUE_NAME,
        buildQueueMessage({
          task: 'new_task',
          created: 12345,
          params: {
            userIds,
            langIds: [],
            projectId,
            keyIds,
          },
        }),
      )

      await waitAndRetry(
        () => (consumerErrorHandler as FakeConsumerErrorResolver).handleErrorCallsCount,
        500,
        5,
      )

      expect((consumerErrorHandler as FakeConsumerErrorResolver).handleErrorCallsCount).toBe(1)
    })
  })
})
