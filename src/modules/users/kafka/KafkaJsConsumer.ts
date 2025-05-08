import type { UsersInjectableDependencies } from '../UserModule.js'
import type { CommonLogger } from '@lokalise/node-core'
import type { Config } from '../../../infrastructure/config.ts'

export class KafkaJsConsumer {
  private readonly logger: CommonLogger
  private readonly kafkaConfig: Config['kafka']

  constructor(deps: UsersInjectableDependencies) {
    this.logger = deps.logger
    this.kafkaConfig = deps.config.kafka
  }

  async connect() {}

  async disconnect() {}

  private consume(message: unknown) {
    this.logger.info(`Received message: ${message}`)
  }
}
