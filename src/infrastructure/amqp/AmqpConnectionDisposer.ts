import type { Connection } from 'amqplib'

import { getConsumers } from '../../modules/consumers'
import type { Dependencies } from '../diConfig'

import type { Consumer } from './AbstractConsumer'

export class AmqpConnectionDisposer {
  private readonly connection: Connection
  private readonly consumers: Consumer[]

  constructor(dependencies: Dependencies) {
    this.connection = dependencies.amqpConnection
    this.consumers = getConsumers(dependencies)
  }

  async close() {
    for (const consumer of this.consumers) {
      await consumer.close()
    }

    await this.connection?.close()
  }
}
