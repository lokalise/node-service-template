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

    this.kafkaClient = new Kafka({
      clientId: 'crdb.next_gen.test',
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
    await this.consumer.subscribe({
      topics: ['crdb.next_gen.autopilot.translation.segment'],
      fromBeginning: false,
    })

    void this.consumer.run({ eachMessage: this.consume })
  }

  async disconnect() {
    await this.consumer?.disconnect()
  }

  private consume({ message, topic }: EachMessagePayload): Promise<void> {
    const messageValue = message.value?.toString('utf8')
    this.logger.info(`${topic} received message: ${messageValue}`)
    return Promise.resolve()
  }
}
