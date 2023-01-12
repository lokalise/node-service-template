import { InternalError } from '@lokalise/node-core'

import type { CommonErrorParams } from './publicErrors'

export class DatabaseUnreachableError extends InternalError {
  constructor(params: CommonErrorParams) {
    super({
      message: params.message,
      errorCode: 'DATABASE_UNREACHABLE',
      details: params.details,
    })
  }
}
