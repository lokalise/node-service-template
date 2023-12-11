import { diContainer } from '@fastify/awilix'
import { deserializeAmqpMessage } from '@message-queue-toolkit/amqp'
import { waitAndRetry } from '@message-queue-toolkit/core'
import type { Channel } from 'amqplib'
import { asClass, Lifetime } from 'awilix'
import type { FastifyInstance } from 'fastify'

import { cleanTables, DB_MODEL } from '../../../../test/DbCleaner'
import { FakeConsumer } from '../../../../test/fakes/FakeConsumer'
import { FakeConsumerErrorResolver } from '../../../../test/fakes/FakeConsumerErrorResolver'
import { getApp } from '../../../app'
import { SINGLETON_CONFIG } from '../../../infrastructure/diConfig'
import { PermissionConsumer } from '../consumers/PermissionConsumer'
import type { PERMISSIONS_ADD_MESSAGE_TYPE } from '../consumers/userConsumerSchemas'
import { PERMISSIONS_ADD_MESSAGE_SCHEMA } from '../consumers/userConsumerSchemas'

import { PermissionPublisher } from './PermissionPublisher'

const perms: [string, ...string[]] = ['perm1', 'perm2']
const userIds = [100, 200, 300]

describe('PermissionPublisher', () => {
  describe('publish', () => {
    let app: FastifyInstance
    let channel: Channel
    beforeAll(async () => {
      app = await getApp(
        {
          queuesEnabled: true,
        },
        {
          consumerErrorResolver: asClass(FakeConsumerErrorResolver, SINGLETON_CONFIG),
          permissionConsumer: asClass(FakeConsumer, {
            lifetime: Lifetime.SINGLETON,
            asyncInit: 'start',
            asyncDispose: 'close',
            asyncDisposePriority: 10,
          }),
        },
      )
    })

    beforeEach(async () => {
      await cleanTables(diContainer.cradle.prisma, [DB_MODEL.User])
      await app.diContainer.cradle.permissionsService.deleteAll()
      channel = await (
        await app.diContainer.cradle.amqpConnectionManager.getConnection()
      ).createChannel()
    })

    afterEach(async () => {
      await channel.deleteQueue(PermissionConsumer.QUEUE_NAME)
      await channel.close()
    })

    afterAll(async () => {
      await app.close()
    })

    it('publishes a message', async () => {
      const { permissionPublisher } = app.diContainer.cradle

      const message = {
        id: 'abc',
        userIds,
        messageType: 'add',
        permissions: perms,
      } satisfies PERMISSIONS_ADD_MESSAGE_TYPE

      let receivedMessage: PERMISSIONS_ADD_MESSAGE_TYPE | null = null
      await channel.consume(PermissionPublisher.QUEUE_NAME, (message) => {
        if (message === null) {
          return
        }
        const decodedMessage = deserializeAmqpMessage(
          message,
          PERMISSIONS_ADD_MESSAGE_SCHEMA,
          new FakeConsumerErrorResolver(),
        )
        receivedMessage = decodedMessage.result!
      })

      permissionPublisher.publish(message)

      await waitAndRetry(() => {
        return receivedMessage !== null
      })

      expect(receivedMessage).toEqual({
        id: 'abc',
        messageType: 'add',
        permissions: ['perm1', 'perm2'],
        userIds: [100, 200, 300],
      })
    })
  })
})
