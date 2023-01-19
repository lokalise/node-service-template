import { InternalError } from '@lokalise/node-core'

import type { CommonErrorParams } from '../errors/publicErrors'

export class AmqpMessageInvalidFormat extends InternalError {
  constructor(params: CommonErrorParams) {
    super({
      message: params.message,
      errorCode: 'AMQP_MESSAGE_INVALID_FORMAT',
      details: params.details,
    })
  }
}

export class AmqpValidationError extends InternalError {
  constructor(params: CommonErrorParams) {
    super({
      message: params.message,
      errorCode: 'AMQP_VALIDATION_ERROR',
      details: params.details,
    })
  }
}
