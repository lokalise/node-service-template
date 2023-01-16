import type { Channel, Connection, Message } from 'amqplib'

import type { Dependencies } from '../diConfig'
import type { ConsumerErrorProcessor } from './ConsumerErrorProcessor'
import { globalLogger, resolveGlobalErrorLogObject } from '../errors/globalErrorHandler'

export interface Consumer {
  consume(): void
  close(): Promise<void>
}

export abstract class AbstractConsumer implements Consumer {
  protected readonly queueName: string
  protected readonly connection: Connection
  protected channel: Channel | undefined
  protected readonly errorHandler: ConsumerErrorProcessor
  private isShuttingDown: boolean

  constructor({ amqpConnection, consumerErrorProcessor }: Dependencies) {
    this.connection = amqpConnection
    this.errorHandler = consumerErrorProcessor
    this.queueName = this.resolveQueueName()
    this.isShuttingDown = false
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

  abstract resolveQueueName(): string

  abstract processMessage(msg: Message | null): Promise<void>

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
      this.processMessage(message).catch((err) => {
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
        this.channel = undefined
      }
    }
  }

  async close(): Promise<void> {
    this.isShuttingDown = true
    await this.destroyConnection()
  }
}
