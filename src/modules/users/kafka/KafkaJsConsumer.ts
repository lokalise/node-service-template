import type { UsersInjectableDependencies } from '../UserModule.js'
import type { CommonLogger } from '@lokalise/node-core'
import type { Config } from '../../../infrastructure/config.ts'
import { type EachMessagePayload, Kafka, type Consumer } from 'kafkajs'

export class KafkaJsConsumer {
  private readonly logger: CommonLogger
  private readonly kafkaConfig: Config['kafka']
  private readonly kafkaClient: Kafka
  private consumer: Consumer | undefined

  constructor(deps: UsersInjectableDependencies) {
    this.logger = deps.logger
    this.kafkaConfig = deps.config.kafka
    console.log(deps.config.kafka)

    this.kafkaClient = new Kafka({
      clientId: 'my_test_client',
      brokers: this.kafkaConfig.brokers,
      ssl: true,
      sasl: {
        mechanism: 'scram-sha-512',
        username: this.kafkaConfig.sasl.username,
        password: this.kafkaConfig.sasl.password,
      },
    })
  }

  async connect() {
    this.consumer = this.kafkaClient.consumer({ groupId: 'crdb.next_gen.test' })

    await this.consumer.connect()
    await this.consumer.subscribe({ topics: ['test-topic'], fromBeginning: false })

    await this.consumer.run({ eachMessage: this.consume })
  }

  async disconnect() {
    await this.consumer?.disconnect()
  }

  private consume(message: EachMessagePayload): Promise<void> {
    this.logger.info(`Received message: ${message}`)
    return Promise.resolve()
  }
}
