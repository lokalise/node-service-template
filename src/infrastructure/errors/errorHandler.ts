import {
  type FreeformRecord,
  isInternalError,
  isObject,
  isPublicNonRecoverableError,
  isStandardizedError,
} from '@lokalise/node-core'
import type { FastifyReply, FastifyRequest } from 'fastify'
import pino from 'pino'

import {
  hasZodFastifySchemaValidationErrors,
  isResponseSerializationError,
} from 'fastify-type-provider-zod'
import type { AppInstance } from '../../app.ts'

const knownAuthErrors = new Set([
  'FST_JWT_NO_AUTHORIZATION_IN_HEADER',
  'FST_JWT_AUTHORIZATION_TOKEN_EXPIRED',
  'FST_JWT_AUTHORIZATION_TOKEN_INVALID',
])

type ResponseObject = {
  statusCode: number
  payload: {
    message: string
    errorCode: string
    details?: FreeformRecord
  }
}

function resolveLogObject(error: unknown): FreeformRecord {
  if (isInternalError(error)) {
    return {
      msg: error.message,
      code: error.errorCode,
      details: error.details ? JSON.stringify(error.details) : undefined,
      error: pino.stdSerializers.err({
        name: error.name,
        message: error.message,
        stack: error.stack,
      }),
    }
  }

  return {
    message: isObject(error) ? error.message : JSON.stringify(error),
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    error: error instanceof Error ? pino.stdSerializers.err(error) : error,
  }
}

function resolveResponseObject(error: FreeformRecord): ResponseObject {
  if (isPublicNonRecoverableError(error)) {
    return {
      statusCode: error.httpStatusCode ?? 500,
      payload: {
        message: error.message,
        errorCode: error.errorCode,
        details: error.details,
      },
    }
  }

  if (hasZodFastifySchemaValidationErrors(error)) {
    return {
      statusCode: 400,
      payload: {
        message: 'Invalid params',
        errorCode: 'VALIDATION_ERROR',
        details: {
          error: error.validation,
        },
      },
    }
  }

  if (isResponseSerializationError(error)) {
    return {
      statusCode: 500,
      payload: {
        message: 'Invalid response',
        errorCode: 'RESPONSE_VALIDATION_ERROR',
        details: {
          error: error.cause.issues,
          method: error.method,
          url: error.url,
        },
      },
    }
  }

  if (isStandardizedError(error)) {
    if (knownAuthErrors.has(error.code)) {
      const message =
        error.code === 'FST_JWT_AUTHORIZATION_TOKEN_INVALID'
          ? 'Authorization token is invalid'
          : error.message

      return {
        statusCode: 401,
        payload: {
          message,
          errorCode: 'AUTH_FAILED',
        },
      }
    }
  }

  return {
    statusCode: 500,
    payload: {
      message: 'Internal server error',
      errorCode: 'INTERNAL_SERVER_ERROR',
    },
  }
}

export const errorHandler = function (
  this: AppInstance,
  error: FreeformRecord,
  request: FastifyRequest,
  reply: FastifyReply,
): void {
  const logObject = resolveLogObject(error)

  // Potentially request can break before we resolved the context
  if (request.reqContext) {
    // this preserves correct request id field
    request.reqContext.logger.error(logObject)
  } else {
    request.log.error(logObject)
  }

  if (isInternalError(error)) {
    this.diContainer.cradle.errorReporter.report({ error })
  }

  const responseObject = resolveResponseObject(error)
  void reply.status(responseObject.statusCode).send(responseObject.payload)
}
