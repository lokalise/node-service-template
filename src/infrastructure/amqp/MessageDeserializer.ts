import type { Message } from 'amqplib'
import type { ZodType } from 'zod'

import type { ConsumerErrorProcessor } from './ConsumerErrorProcessor'

export const deserializeMessage = <T>(
  message: Message,
  type: ZodType<T>,
  errorHandler: ConsumerErrorProcessor,
): T => {
  try {
    return type.parse(JSON.parse(message.content.toString()))
  } catch (exception) {
    errorHandler.processError(exception)

    throw exception
  }
}
