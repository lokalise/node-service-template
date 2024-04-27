import { diContainer } from '@fastify/awilix'
import { deserializeAmqpMessage } from '@message-queue-toolkit/amqp'
import { waitAndRetry } from '@message-queue-toolkit/core'
import type { Channel } from 'amqplib'
import { asClass, Lifetime } from 'awilix'
import { asMockClass } from 'awilix-manager'

import { cleanTables, DB_MODEL } from '../../../../test/DbCleaner.js'
import { FakeConsumer } from '../../../../test/fakes/FakeConsumer.js'
import { FakeConsumerErrorResolver } from '../../../../test/fakes/FakeConsumerErrorResolver.js'
import type { AppInstance } from '../../../app.js'
import { getApp } from '../../../app.js'
import { SINGLETON_CONFIG } from '../../../infrastructure/diConfig.js'
import { PermissionConsumer } from '../consumers/PermissionConsumer.js'
import type { PERMISSIONS_ADD_MESSAGE_TYPE } from '../consumers/userConsumerSchemas.js'
import { PERMISSIONS_ADD_MESSAGE_SCHEMA } from '../consumers/userConsumerSchemas.js'

import { PermissionPublisher } from './PermissionPublisher.js'

const perms: [string, ...string[]] = ['perm1', 'perm2']
const userIds = [100, 200, 300]

describe('PermissionPublisher', () => {
  describe('publish', () => {
    let app: AppInstance
    let channel: Channel
    beforeAll(async () => {
      app = await getApp(
        {
          queuesEnabled: [PermissionPublisher.QUEUE_NAME],
        },
        {
          consumerErrorResolver: asClass(FakeConsumerErrorResolver, SINGLETON_CONFIG),
          permissionConsumer: asMockClass(FakeConsumer, {
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
