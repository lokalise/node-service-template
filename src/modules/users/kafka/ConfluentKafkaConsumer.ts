import type { UsersInjectableDependencies } from '../UserModule.js'
import type { CommonLogger } from '@lokalise/node-core'
import type { Config } from '../../../infrastructure/config.ts'
import { KafkaJS } from '@confluentinc/kafka-javascript'


export class ConfluentKafkaConsumer {
  private readonly logger: CommonLogger
  private readonly kafkaConfig: Config['kafka']
  private readonly kafkaClient: KafkaJS.Kafka
  private consumer: KafkaJS.Consumer | undefined

  constructor(deps: UsersInjectableDependencies) {
    this.logger = deps.logger
    this.kafkaConfig = deps.config.kafka

    this.kafkaClient = new KafkaJS.Kafka({
      'client.id': 'crdb.next_gen.test',
      'bootstrap.servers': this.kafkaConfig.brokers.join(','),
      'sasl.mechanism': 'SCRAM-SHA-512',
      'security.protocol': 'sasl_ssl',
      'sasl.username': this.kafkaConfig.sasl.username,
      'sasl.password': this.kafkaConfig.sasl.password,

      // Alternatively, you can use KafkaJS like configuration:
      // kafkaJS: {
      //   clientId: 'crdb.next_gen.test',
      //   brokers: this.kafkaConfig.brokers,
      //   ssl: true,
      //   sasl: {
      //     mechanism: 'scram-sha-512',
      //     username: this.kafkaConfig.sasl.username,
      //     password: this.kafkaConfig.sasl.password,
      //   },
      // }
    })
  }

  async connect() {
    this.consumer = this.kafkaClient.consumer({ kafkaJS: { groupId: 'crdb.next_gen.test', fromBeginning: false } })

    await this.consumer.connect()
    await this.consumer.subscribe({
      topics: ['crdb.next_gen.autopilot.translation.segment'],
    })

    void this.consumer.run({ eachMessage: this.consume.bind(this) })
  }

  async disconnect() {
    await this.consumer?.disconnect()
  }

  private consume({ message, topic }: KafkaJS.EachMessagePayload): Promise<void> {
    const messageValue = message.value?.toString('utf8')
    if (!messageValue || messageValue.length === 0 || messageValue.includes('resolved')) {
      return Promise.resolve()
    }

    this.logger.info(`${topic} Received message ${messageValue} `)
    return Promise.resolve()
  }
}
