import type { NewRelicTransactionManager } from '@lokalise/fastify-extras'
import type { Either } from '@lokalise/node-core'
import type { Message } from 'amqplib'

import type { Dependencies } from '../diConfig'
import { globalLogger, resolveGlobalErrorLogObject } from '../errors/globalErrorHandler'
import { isError } from '../typeUtils'

import type { QueueParams } from './AbstractQueueService'
import { AbstractQueueService } from './AbstractQueueService'
import type { CommonMessage } from './MessageTypes'
import { AmqpMessageInvalidFormat, AmqpValidationError } from './amqpErrors'
import { deserializeMessage } from './messageDeserializer'

export interface Consumer {
  consume(): void
  close(): Promise<void>
}

const ABORT_EARLY_EITHER: Either<'abort', never> = {
  error: 'abort',
}

export abstract class AbstractConsumer<MessagePayloadType extends CommonMessage>
  extends AbstractQueueService<MessagePayloadType>
  implements Consumer
{
  private readonly newRelicBackgroundTransactionManager: NewRelicTransactionManager

  constructor(params: QueueParams<MessagePayloadType>, dependencies: Dependencies) {
    super(params, dependencies)
    this.newRelicBackgroundTransactionManager = dependencies.newRelicBackgroundTransactionManager
  }

  abstract processMessage(
    messagePayload: MessagePayloadType,
  ): Promise<Either<'retryLater', 'success'>>

  private deserializeMessage(message: Message | null): Either<'abort', MessagePayloadType> {
    if (message === null) {
      return ABORT_EARLY_EITHER
    }

    const deserializationResult = deserializeMessage(
      message,
      this.messageSchema,
      this.errorResolver,
    )

    if (
      deserializationResult.error instanceof AmqpValidationError ||
      deserializationResult.error instanceof AmqpMessageInvalidFormat
    ) {
      const logObject = resolveGlobalErrorLogObject(deserializationResult.error)
      globalLogger.error(logObject)
      this.errorReporter.report({ error: deserializationResult.error })
      return ABORT_EARLY_EITHER
    }

    // Empty content for whatever reason
    if (!deserializationResult.result) {
      return ABORT_EARLY_EITHER
    }

    return {
      result: deserializationResult.result,
    }
  }

  async consume() {
    await this.init()
    if (!this.channel) {
      throw new Error('Channel is not set')
    }

    await this.channel.consume(this.queueName, (message) => {
      if (message === null) {
        return
      }

      const deserializedMessage = this.deserializeMessage(message)
      if (deserializedMessage.error === 'abort') {
        this.channel.nack(message, false, false)
        return
      }
      const transactionSpanId = `queue_${this.queueName}:${deserializedMessage.result.messageType}`

      this.newRelicBackgroundTransactionManager.start(transactionSpanId)
      this.processMessage(deserializedMessage.result)
        .then((result) => {
          if (result.error === 'retryLater') {
            this.channel.nack(message, false, true)
          }
          if (result.result === 'success') {
            this.channel.ack(message)
          }
        })
        .catch((err) => {
          // ToDo we need sanity check to stop trying at some point, perhaps some kind of Redis counter
          // If we fail due to unknown reason, let's retry
          this.channel.nack(message, false, true)
          const logObject = resolveGlobalErrorLogObject(err)
          globalLogger.error(logObject)
          if (isError(err)) {
            this.errorReporter.report({ error: err })
          }
        })
        .finally(() => {
          this.newRelicBackgroundTransactionManager.stop(transactionSpanId)
        })
    })
  }
}
