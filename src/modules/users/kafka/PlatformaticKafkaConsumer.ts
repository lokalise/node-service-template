import {
  Consumer,
  stringDeserializers,
  type Message,
  type MessagesStream,
} from '@platformatic/kafka'
import type { UsersInjectableDependencies } from '../UserModule.js'
import type { CommonLogger } from '@lokalise/node-core'
import type { Config } from '../../../infrastructure/config.ts'

export class PlatformaticKafkaConsumer {
  private readonly logger: CommonLogger
  private readonly kafkaConfig: Config['kafka']

  private consumer: Consumer<string, string, string, string> | undefined
  private stream: MessagesStream<string, string, string, string> | undefined

  constructor(deps: UsersInjectableDependencies) {
    this.logger = deps.logger
    this.kafkaConfig = deps.config.kafka
  }

  async connect() {
    const clientId = 'my_test_client'
    /*
    const response = await saslScramSha.authenticate(
      {},
      new Connection(clientId),
      'SHA-512',
      'my-test-user',
      'my-test-secret',
    )
    */
    this.consumer = new Consumer({
      clientId,
      groupId: 'crdb.next_gen.test',
      bootstrapBrokers: this.kafkaConfig.brokers,
      deserializers: stringDeserializers,
      /*protocols: [
      {
        name: 'SaslAuthenticate',
        version: 1,
        metadata: '',
      },
    ],*/
    })

    this.stream = await this.consumer.consume({ topics: ['my-topic'] })
    this.stream.on('data', (message) => {
      this.consume(message)
    })
  }

  async disconnect() {
    this.stream?.close()
    await this.consumer?.close()
  }

  private consume(message: Message<string, string, string, string>) {
    this.logger.info(`Received message: ${message.value}`)
  }
}
