import type { Channel, Connection, Message } from 'amqplib'

import type { Dependencies } from '../diConfig'
import type { ConsumerErrorResolver } from './ConsumerErrorResolver'
import { globalLogger, resolveGlobalErrorLogObject } from '../errors/globalErrorHandler'
import { ZodSchema } from 'zod'
import { deserializeMessage } from './messageDeserializer'
import { AmqpMessageInvalidFormat, AmqpValidationError } from './amqpErrors'
import { Either } from '@lokalise/node-core'

export interface Consumer {
  consume(): void
  close(): Promise<void>
}

const ABORT_EARLY_EITHER: Either<'abort', never> = {
  error: 'abort',
}

export type ConsumerParams<MessagePayloadType> = {
  queueName: string
  messageSchema: ZodSchema<MessagePayloadType>
}

export abstract class AbstractConsumer<MessagePayloadType> implements Consumer {
  protected readonly queueName: string
  protected readonly connection: Connection
  // @ts-ignore
  protected channel: Channel
  protected readonly errorHandler: ConsumerErrorResolver
  private isShuttingDown: boolean

  private messageSchema: ZodSchema<MessagePayloadType>

  constructor(
    params: ConsumerParams<MessagePayloadType>,
    { amqpConnection, consumerErrorProcessor }: Dependencies,
  ) {
    this.connection = amqpConnection
    this.errorHandler = consumerErrorProcessor
    this.isShuttingDown = false
    this.queueName = params.queueName
    this.messageSchema = params.messageSchema
  }

  async init() {
    this.isShuttingDown = false
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
  }

  protected deserializeMessage(message: Message | null): Either<'abort', MessagePayloadType> {
    if (message === null) {
      return ABORT_EARLY_EITHER
    }

    const deserializationResult = deserializeMessage(message, this.messageSchema, this.errorHandler)

    if (
      deserializationResult.error instanceof AmqpValidationError ||
      deserializationResult.error instanceof AmqpMessageInvalidFormat
    ) {
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

  abstract processMessage(
    messagePayload: MessagePayloadType,
  ): Promise<Either<'retryLater', 'success'>>

  async consume() {
    await this.init()
    if (!this.channel) {
      throw new Error('Channel is not set')
    }

    await this.channel.assertQueue(this.queueName, {
      exclusive: false,
      durable: true,
      autoDelete: false,
    })

    await this.channel.consume(this.queueName, (message) => {
      if (message === null) {
        return
      }

      const messagePayload = this.deserializeMessage(message)
      if (messagePayload.error === 'abort') {
        this.channel.nack(message, false, false)
        return
      }

      this.processMessage(messagePayload.result)
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
