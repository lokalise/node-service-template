import { InternalError } from '@lokalise/node-core'
import { ZodError } from 'zod'

import type { ErrorResolver } from '../errors/ErrorResolver'
import { isStandardizedError } from '../typeUtils'

import { AmqpMessageInvalidFormat, AmqpValidationError } from './amqpErrors'

export class ConsumerErrorResolver implements ErrorResolver {
  public processError(error: unknown): InternalError {
    if (error instanceof Error && error?.name === 'SyntaxError') {
      return new AmqpMessageInvalidFormat({
        message: error.message,
      })
    }
    if (error instanceof ZodError) {
      return new AmqpValidationError({
        message: error.message,
        details: {
          error: error.issues,
        },
      })
    }
    if (isStandardizedError(error)) {
      return new InternalError({
        message: error.message,
        errorCode: error.code,
      })
    }
    return new InternalError({
      message: 'Error processing message',
      errorCode: 'INTERNAL_ERROR',
    })
  }
}
