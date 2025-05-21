import {
  Connection,
  Consumer,
  saslAuthenticateV2,
  saslHandshakeV1,
  stringDeserializers,
  type Message,
  type MessagesStream,
  saslScramSha,
} from '@platformatic/kafka'
import type { UsersInjectableDependencies } from '../UserModule.js'
import type { CommonLogger } from '@lokalise/node-core'
import type { Config } from '../../../infrastructure/config.ts'

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

  async connect() {
    const clientId = 'crdb.next_gen.test'
    const groupId = 'crdb.next_gen.test'

    const [kafkaHost, kafkaPort] = (() => {
      const [host, port] = this.kafkaConfig.brokers[0]!.split(':')
      return [host, Number(port)] as [string, number]
    })()


    const connection = new Connection(clientId, {
      tls: {} // Required to use TLS connection strategy
    })
    const connectPromise = connection.connect(kafkaHost, kafkaPort)
    const readyPromise = connection.ready()

    await readyPromise
    await connectPromise

    this.logger.info({
      host: kafkaHost,
      port: kafkaPort,
      connectionStatus: connection.status,
    }, 'Kafka connection established')

    const handshakeResponse = await saslHandshakeV1.api.async(connection, 'SCRAM-SHA-512')

    const authResponse = await saslScramSha.authenticate(
      saslAuthenticateV2.api,
      connection,
      'SHA-512',
      this.kafkaConfig.sasl.username,
      this.kafkaConfig.sasl.password,
    )

    this.logger.info({
      connectionStatus: connection.status,
    }, 'Kafka connection authenticated')

    // TODO Figure out how to use authorization in Consumer
    this.consumer = new Consumer({
      clientId,
      groupId,
      bootstrapBrokers: this.kafkaConfig.brokers,
      deserializers: stringDeserializers,
      // protocols: [
      // {
      //   name: 'SaslAuthenticate',
      //   version: 1,
      //   metadata: '',
      // },
      // ],
    })

    this.stream = await this.consumer.consume({ topics: ['crdb.next_gen.autopilot.translation.segment'] })
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
