import type { Connection } from 'amqplib'

import { getConsumers } from '../../modules/consumers'
import { getPublishers } from '../../modules/publishers'
import type { Dependencies } from '../diConfig'

import type { Consumer } from './AbstractConsumer'
import type { AbstractPublisher } from './AbstractPublisher'
import type { CommonMessage } from './MessageTypes'

/**
 * This disposer ensures correct sequence for amqp disposal, making sure that consumer do not error out
 * while still trying to operate on already closed connection
 */
export class AmqpConnectionDisposer {
  private readonly connection: Connection
  private readonly consumers: Consumer[]
  private readonly publishers: AbstractPublisher<CommonMessage>[]

  constructor(dependencies: Dependencies) {
    this.connection = dependencies.amqpConnection
    this.consumers = getConsumers(dependencies)
    this.publishers = getPublishers(dependencies)
  }

  async close() {
    for (const consumer of this.consumers) {
      await consumer.close()
    }
    for (const publisher of this.publishers) {
      await publisher.close()
    }

    await this.connection?.close()
  }
}
