import type { ErrorReporter } from '@lokalise/node-core'
import { resolveGlobalErrorLogObject } from '@lokalise/node-core'
import type { Channel, Connection } from 'amqplib'
import type { FastifyBaseLogger } from 'fastify'
import type { ZodSchema } from 'zod'

import type { Dependencies } from '../diConfig'

import type { ConsumerErrorResolver } from './ConsumerErrorResolver'
import type { CommonMessage } from './MessageTypes'

export type QueueParams<MessagePayloadType extends CommonMessage> = {
  queueName: string
  messageSchema: ZodSchema<MessagePayloadType>
}

export class AbstractQueueService<MessagePayloadType extends CommonMessage> {
  protected readonly queueName: string
  protected readonly connection: Connection
  // @ts-ignore
  protected channel: Channel
  protected readonly errorResolver: ConsumerErrorResolver
  private isShuttingDown: boolean
  protected errorReporter: ErrorReporter
  protected messageSchema: ZodSchema<MessagePayloadType>
  protected readonly logger: FastifyBaseLogger

  constructor(
    params: QueueParams<MessagePayloadType>,
    { amqpConnection, consumerErrorResolver, errorReporter, logger }: Dependencies,
  ) {
    this.connection = amqpConnection
    this.errorResolver = consumerErrorResolver
    this.isShuttingDown = false
    this.queueName = params.queueName
    this.messageSchema = params.messageSchema
    this.errorReporter = errorReporter
    this.logger = logger
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

  public async init() {
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
        this.logger.error(`AMQP connection lost!`)
        this.init().catch((err) => {
          this.logger.error(err)
          throw err
        })
      }
    })
    this.channel.on('error', (err) => {
      const logObject = resolveGlobalErrorLogObject(err)
      this.logger.error(logObject)
    })

    await this.channel.assertQueue(this.queueName, {
      exclusive: false,
      durable: true,
      autoDelete: false,
    })
  }

  async close(): Promise<void> {
    this.isShuttingDown = true
    await this.destroyConnection()
  }
}
