import { isStandardizedError } from '../typeUtils'

import { AmqpMessageInvalidFormat } from './amqpErrors'
import { ErrorResolver } from '../errors/ErrorResolver'
import { InternalError } from '@lokalise/node-core'
import { ZodError } from 'zod'

export class ConsumerErrorResolver implements ErrorResolver {
  public processError(error: unknown): InternalError {
    if (error instanceof Error && error?.name === 'SyntaxError') {
      return new AmqpMessageInvalidFormat({
        message: error.message,
      })
    }
    if (error instanceof ZodError) {
      return new InternalError({
        message: error.message,
        errorCode: 'VALIDATION_ERROR',
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
