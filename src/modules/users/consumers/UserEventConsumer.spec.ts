import { PublishCommand } from '@aws-sdk/client-sns'
import type { Cradle } from '@fastify/awilix'
import type { AwilixContainer } from 'awilix'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
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

    beforeEach(async () => {
      app = await getApp({
        messageQueueConsumersEnabled: [UserEventConsumer.QUEUE_NAME],
        monitoringEnabled: true,
      })
      diContainer = app.diContainer
      consumer = diContainer.cradle.userEventConsumer
    })

    afterEach(async () => {
      await app.close()
    })

    it('Consumes user.created message successfully', async () => {
      const { snsClient } = diContainer.cradle

      const topicArn = consumer['topicArn']

      await snsClient.send(
        new PublishCommand({
          TopicArn: topicArn,
          Message: JSON.stringify({
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
          }),
        }),
      )

      const messageResult = await consumer.handlerSpy.waitForMessageWithId('test-msg-1')
      expect(messageResult.processingResult).toEqual({
        status: 'consumed',
      })
    })

    it('Registers message processing metrics', async () => {
      const { snsClient } = diContainer.cradle

      expect(diContainer.cradle.messageProcessingMetricsManager).toBeDefined()
      const metricsSpy = vi.spyOn(
        diContainer.cradle.messageProcessingMetricsManager!,
        'registerProcessedMessage',
      )

      const topicArn = consumer['topicArn']

      const messageId = 'test-metrics-msg'
      await snsClient.send(
        new PublishCommand({
          TopicArn: topicArn,
          Message: JSON.stringify({
            id: messageId,
            type: 'user.created',
            timestamp: new Date().toISOString(),
            metadata: {
              schemaVersion: '1.0.0',
              producedBy: 'test',
              originatedFrom: 'test',
              correlationId: 'test-correlation-2',
            },
            payload: {
              userId: 'user-456',
              name: 'Metrics User',
              email: 'metrics@example.com',
            },
          }),
        }),
      )

      await consumer.handlerSpy.waitForMessageWithId(messageId, 'consumed')

      expect(metricsSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          messageId: messageId,
          messageType: 'user.created',
          processingResult: {
            status: 'consumed',
          },
          queueName: UserEventConsumer.QUEUE_NAME,
        }),
      )
    })
  })
})
