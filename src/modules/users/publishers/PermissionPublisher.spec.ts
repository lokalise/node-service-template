import { diContainer } from '@fastify/awilix'
import { deserializeAmqpMessage } from '@message-queue-toolkit/amqp'
import { waitAndRetry } from '@message-queue-toolkit/core'
import type { Channel } from 'amqplib'
import { asClass, Lifetime } from 'awilix'
import { asMockClass } from 'awilix-manager'

import { cleanTables, DB_MODEL } from '../../../../test/DbCleaner.js'
import { FakeConsumer } from '../../../../test/fakes/FakeConsumer.js'
import { FakeConsumerErrorResolver } from '../../../../test/fakes/FakeConsumerErrorResolver.js'
import { createRequestContext } from '../../../../test/requestUtils.js'
import type { AppInstance } from '../../../app.js'
import { getApp } from '../../../app.js'
import { SINGLETON_CONFIG } from '../../../infrastructure/parentDiConfig.js'
import { PermissionConsumer } from '../consumers/PermissionConsumer.js'
import type { AddPermissionsMessageType } from '../consumers/userConsumerSchemas.js'
import { PERMISSIONS_ADD_MESSAGE_SCHEMA } from '../consumers/userConsumerSchemas.js'

import { PermissionPublisher } from './PermissionPublisher.js'

const perms: [string, ...string[]] = ['perm1', 'perm2']
const userIds = ['100', '200', '300']
const testRequestContext = createRequestContext()

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
      await app.diContainer.cradle.permissionsService.deleteAll(testRequestContext)
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
        type: 'add',
        timestamp: new Date().toISOString(),
        payload: {
          userIds,
          permissions: perms,
        },
      } satisfies AddPermissionsMessageType

      let receivedMessage: AddPermissionsMessageType | null = null
      await channel.consume(PermissionPublisher.QUEUE_NAME, (message) => {
        if (message === null) {
          return
        }
        const decodedMessage = deserializeAmqpMessage(
          message,
          PERMISSIONS_ADD_MESSAGE_SCHEMA,
          new FakeConsumerErrorResolver(),
        )
        receivedMessage = decodedMessage.result!.parsedMessage
      })

      permissionPublisher.publish(message)

      await waitAndRetry(() => {
        return receivedMessage !== null
      })

      expect(receivedMessage).toEqual({
        id: 'abc',
        type: 'add',
        timestamp: expect.any(String),
        payload: {
          permissions: ['perm1', 'perm2'],
          userIds: ['100', '200', '300'],
        },
      })
    })
  })
})
