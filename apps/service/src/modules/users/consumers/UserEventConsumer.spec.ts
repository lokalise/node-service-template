import { GetSubscriptionAttributesCommand } from '@aws-sdk/client-sns'
import type { Cradle } from '@fastify/awilix'
import { TestSnsPublisher } from '@message-queue-toolkit/sns'
import type { AwilixContainer } from 'awilix'
import type { FauxqsServer } from 'fauxqs'
import { seedTestFauxqs, startTestFauxqs, stopTestFauxqs } from '../../../../test/FauxqsHelper.ts'
import type { AppInstance } from '../../../app.ts'
import { getApp } from '../../../app.ts'
import { UserEventConsumer } from './UserEventConsumer.ts'

describe('UserEventConsumer', () => {
  let fauxqs: FauxqsServer

  beforeAll(async () => {
    fauxqs = await startTestFauxqs()
  })

  afterAll(async () => {
    await stopTestFauxqs()
  })

  // A single app per file: a closed consumer's last long poll can still take the next message
  describe('with seeded resources', () => {
    let app: AppInstance
    let diContainer: AwilixContainer<Cradle>
    let consumer: UserEventConsumer
    let testPublisher: TestSnsPublisher

    beforeAll(async () => {
      app = await getApp({
        messageQueueConsumersEnabled: [UserEventConsumer.QUEUE_NAME],
      })
      diContainer = app.diContainer
      consumer = diContainer.cradle.userEventConsumer
      testPublisher = new TestSnsPublisher(
        diContainer.cradle.snsClient,
        diContainer.cradle.stsClient,
      )
    })

    afterAll(async () => {
      await app.close()
    })

    it('Sets only the filter policy on the located subscription', async () => {
      const [subscription] = seedTestFauxqs().subscriptions

      const { Attributes } = await diContainer.cradle.snsClient.send(
        new GetSubscriptionAttributesCommand({ SubscriptionArn: subscription?.subscriptionArn }),
      )
      expect(subscription?.created).toBe(false)
      expect(Attributes).toMatchObject({
        FilterPolicy: JSON.stringify({ type: ['user.created'] }),
        FilterPolicyScope: 'MessageBody',
      })
    })

    it('Consumes user.created message successfully', async () => {
      await testPublisher.publish(
        {
          id: 'test-msg-1',
          type: 'user.created',
          timestamp: new Date().toISOString(),
          metadata: {
            schemaVersion: '1.0.0',
            producedBy: 'test',
            originatedFrom: 'test',
            correlationId: 'test-correlation-1',
          },
          payload: {
            userId: 'user-123',
            name: 'Test User',
            email: 'test@example.com',
          },
        },
        { consumer },
      )

      const messageResult = await consumer.handlerSpy.waitForMessageWithId('test-msg-1')
      expect(messageResult.processingResult).toEqual({
        status: 'consumed',
      })
    })
  })

  describe('without seeded resources', () => {
    let app: AppInstance

    beforeAll(async () => {
      app = await getApp({ messageQueueConsumersEnabled: false })
    })

    afterAll(async () => {
      await app.close()
      seedTestFauxqs()
    })

    it('Fails instead of creating a missing topic', async () => {
      fauxqs.deleteTopic(UserEventConsumer.TOPIC_NAME)

      await expect(new UserEventConsumer(app.diContainer.cradle).init()).rejects.toThrow(
        /does not exist/,
      )
      // Re-seeding creates the topic again, so the consumer did not create it
      expect(seedTestFauxqs().topics[0]?.created).toBe(true)
    })
  })
})
