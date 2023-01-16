import { setTimeout } from 'timers/promises'

import type { Connection } from 'amqplib'

import type { Dependencies } from '../diConfig'
import {Consumer} from "./AbstractConsumer";

export class RabbitMqDisposer {
  private readonly connection: Connection
  private readonly consumers: Consumer[]

  constructor({ amqpConnection }: Dependencies) {
    this.connection = amqpConnection
    this.consumers = getConsumers(dependencies).consumers
  }

  async close() {
    // this is necessary for connections to close correctly
    await setTimeout(100)
    for (const consumer of this.consumers) {
      await consumer.close()
    }

    await this.connection?.close()
  }
}
