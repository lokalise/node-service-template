import type { ConsumerBaseMessageType, ProcessedMessageMetadata } from '@message-queue-toolkit/core'
import {
  MessageLifetimeMetric,
  MessageProcessingMultiMetrics,
  MessageProcessingTimeMetric,
} from '@message-queue-toolkit/metrics'
import type { IFastifyMetrics } from 'fastify-metrics'

export class MessageProcessingMetricsManager extends MessageProcessingMultiMetrics<ConsumerBaseMessageType> {
  constructor(appMetrics: IFastifyMetrics) {
    const buckets = [100, 200, 300, 500, 1000, 3000, 10000, 50000, 100000]
    const messageVersionResolver = (
      messageMetadata: ProcessedMessageMetadata<ConsumerBaseMessageType>,
    ) => {
      return messageMetadata.message?.metadata.schemaVersion
    }

    super([
      new MessageProcessingTimeMetric(
        {
          name: 'message_processing_milliseconds',
          helpDescription: 'Message processing time in milliseconds',
          buckets,
          messageVersion: messageVersionResolver,
        },
        appMetrics.client,
      ),
      new MessageLifetimeMetric(
        {
          name: 'message_lifetime_milliseconds',
          helpDescription: 'Message lifetime in milliseconds',
          buckets,
          messageVersion: messageVersionResolver,
        },
        appMetrics.client,
      ),
    ])
  }
}
