import { setTimeout } from 'timers/promises'

import { connect } from 'amqplib'

import type { AmqpConfig } from '../config'
import { globalLogger } from '../errors/globalErrorHandler'

const CONNECT_RETRY_SECONDS = 10
const MAX_RETRY_ATTEMPTS = 5

export async function resolveAmqpConnection(config: AmqpConfig) {
  const protocol = config.useTls ? 'amqps' : 'amqp'
  let counter = 0
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const url = `${protocol}://${config.username}:${config.password}@${config.hostname}:${config.port}/${config.vhost}`

    try {
      return await connect(url)
    } catch (e) {
      globalLogger.error(
        `Failed to connect to AMQP broker at ${config.hostname}:${config.port}. Retrying in ${CONNECT_RETRY_SECONDS} seconds...`,
      )
    }
    await setTimeout(CONNECT_RETRY_SECONDS * 1000)
    counter++

    if (counter > MAX_RETRY_ATTEMPTS) {
      throw new Error('Failed to resolve AMQP connection')
    }
  }
}
