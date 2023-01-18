import type { Either } from '@lokalise/node-core'
import type { Message } from 'amqplib'
import type { ZodType } from 'zod'

import type { ConsumerErrorResolver } from './ConsumerErrorResolver'
import type { AmqpMessageInvalidFormat, AmqpValidationError } from './amqpErrors'

export const deserializeMessage = <T>(
  message: Message,
  type: ZodType<T>,
  errorProcessor: ConsumerErrorResolver,
): Either<AmqpMessageInvalidFormat | AmqpValidationError, T> => {
  try {
    return {
      result: type.parse(JSON.parse(message.content.toString())),
    }
  } catch (exception) {
    return {
      error: errorProcessor.processError(exception),
    }
  }
}
