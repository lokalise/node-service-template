import type { Either } from '@lokalise/node-core'
import type { Channel, Connection, Message } from 'amqplib'
import type { ZodSchema } from 'zod'

import type { Dependencies } from '../diConfig'
import type { ErrorReporter } from '../errors/errorReporter'
import { globalLogger, resolveGlobalErrorLogObject } from '../errors/globalErrorHandler'
import { isError } from '../typeUtils'

import type { ConsumerErrorResolver } from './ConsumerErrorResolver'
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

export type ConsumerParams<MessagePayloadType extends CommonMessage> = {
  queueName: string
  messageSchema: ZodSchema<MessagePayloadType>
}

export abstract class AbstractConsumer<MessagePayloadType extends CommonMessage>
  implements Consumer
{
  protected readonly queueName: string
  protected readonly connection: Connection
  // @ts-ignore
  protected channel: Channel
  protected readonly errorResolver: ConsumerErrorResolver
  private readonly newRelicBackgroundTransactionManager
  private isShuttingDown: boolean

  private messageSchema: ZodSchema<MessagePayloadType>
  private errorReporter: ErrorReporter

  constructor(
    params: ConsumerParams<MessagePayloadType>,
    {
      amqpConnection,
      consumerErrorResolver,
      newRelicBackgroundTransactionManager,
      errorReporter,
    }: Dependencies,
  ) {
    this.connection = amqpConnection
    this.errorResolver = consumerErrorResolver
    this.isShuttingDown = false
    this.queueName = params.queueName
    this.messageSchema = params.messageSchema
    this.newRelicBackgroundTransactionManager = newRelicBackgroundTransactionManager
    this.errorReporter = errorReporter
  }

  abstract processMessage(
    messagePayload: MessagePayloadType,
  ): Promise<Either<'retryLater', 'success'>>

  private async init() {
    this.isShuttingDown = false

    // If channel exists, recreate it
    if (this.channel) {
      this.isShuttingDown = true
      await this.destroyConnection()
      this.isShuttingDown = false
    }

    this.channel = await this.connection.createChannel()
    this.channel.on('close', () => {
      if (!this.isShuttingDown) {
        globalLogger.error(`AMQP connection lost!`)
        this.init().catch((err) => {
          globalLogger.error(err)
          throw err
        })
      }
    })
    this.channel.on('error', (err) => {
      const logObject = resolveGlobalErrorLogObject(err)
      globalLogger.error(logObject)
    })

    await this.channel.assertQueue(this.queueName, {
      exclusive: false,
      durable: true,
      autoDelete: false,
    })
  }

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

  private async destroyConnection(): Promise<void> {
    if (this.channel) {
      try {
        await this.channel.close()
      } finally {
        // @ts-ignore
        this.channel = undefined
      }
    }
  }

  async close(): Promise<void> {
    this.isShuttingDown = true
    await this.destroyConnection()
  }
}
