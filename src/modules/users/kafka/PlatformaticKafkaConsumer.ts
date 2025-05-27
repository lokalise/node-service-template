import {
  Consumer,
  type Message,
  type MessagesStream,
  Connection,
  saslHandshakeV1,
  saslScramSha,
  saslAuthenticateV2,
  stringDeserializers,
} from '@platformatic/kafka'
import type { UsersInjectableDependencies } from '../UserModule.js'
import type { CommonLogger } from '@lokalise/node-core'
import type { Config } from '../../../infrastructure/config.ts'
import { randomUUID } from 'node:crypto'

/**
 * NOTE: this is not working yet, it's only a playground for testing connection
 */
export class PlatformaticKafkaConsumer {
  private readonly logger: CommonLogger
  private readonly kafkaConfig: Config['kafka']

  private consumer: Consumer<string, string, string, string> | undefined
  private stream: MessagesStream<string, string, string, string> | undefined

  constructor(deps: UsersInjectableDependencies) {
    this.logger = deps.logger
    this.kafkaConfig = deps.config.kafka
  }

  private async manualAuth() {
    const [kafkaHost, kafkaPort] = (() => {
      // biome-ignore lint/style/noNonNullAssertion: <explanation>
      const [host, port] = this.kafkaConfig.brokers[0]!.split(':')
      return [host, Number(port)] as [string, number]
    })()

    const connection = new Connection(this.kafkaConfig.clientId, {
      tls: {}, // Required to use TLS connection strategy
    })
    const connectPromise = connection.connect(kafkaHost, kafkaPort)
    const readyPromise = connection.ready()

    await readyPromise
    await connectPromise

    this.logger.info(
      {
        host: kafkaHost,
        port: kafkaPort,
        connectionStatus: connection.status,
      },
      'Kafka connection established',
    )

    const _handshakeResponse = await saslHandshakeV1.api.async(connection, 'SCRAM-SHA-512')

    const _authResponse = await saslScramSha.authenticate(
      saslAuthenticateV2.api,
      connection,
      'SHA-512',
      this.kafkaConfig.sasl.username,
      this.kafkaConfig.sasl.password,
    )

    this.logger.info(
      {
        connectionStatus: connection.status,
      },
      'Kafka connection authenticated',
    )
  }

  async connect() {
    this.consumer = new Consumer({
      clientId: this.kafkaConfig.clientId,
      groupId: this.kafkaConfig.groupId + randomUUID(),
      bootstrapBrokers: this.kafkaConfig.brokers,
      deserializers: stringDeserializers,
      tls: {}, // <- this is required for whatever reason
      sasl: {
        mechanism: 'SCRAM-SHA-512',
        username: this.kafkaConfig.sasl.username,
        password: this.kafkaConfig.sasl.password,
      },
    })

    this.stream = await this.consumer.consume({
      topics: ['crdb.next_gen.autopilot.translation.segment'],
      mode: 'latest',
    })
    this.stream.on('error', (error) => {
      this.logger.error({ error }, 'Error in Kafka stream')
    })
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
