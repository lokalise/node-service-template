import type { Cradle } from '@fastify/awilix'
import { TestSnsPublisher } from '@message-queue-toolkit/sns'
import type { AwilixContainer } from 'awilix'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { startTestFauxqs, stopTestFauxqs } from '../../../../test/FauxqsHelper.ts'
import type { AppInstance } from '../../../app.ts'
import { getApp } from '../../../app.ts'
import { UserEventConsumer } from './UserEventConsumer.ts'

describe('UserEventConsumer', () => {
  beforeAll(async () => {
    await startTestFauxqs()
  })

  afterAll(async () => {
    await stopTestFauxqs()
  })

  describe('consume', () => {
    let app: AppInstance
    let diContainer: AwilixContainer<Cradle>
    let consumer: UserEventConsumer
    let testPublisher: TestSnsPublisher

    beforeEach(async () => {
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

    afterEach(async () => {
      await app.close()
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
})
