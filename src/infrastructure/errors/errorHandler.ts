import { InternalError, PublicNonRecoverableError } from '@lokalise/node-core'
import type { FastifyRequest, FastifyReply, FastifyInstance } from 'fastify'
import pino from 'pino'
import { ZodError } from 'zod'

import type { FreeformRecord } from '../../schemas/commonTypes'
import { isObject, isStandardizedError } from '../typeUtils'

const knownErrors = new Set([
  'FST_JWT_NO_AUTHORIZATION_IN_HEADER',
  'FST_JWT_AUTHORIZATION_TOKEN_EXPIRED',
  'FST_JWT_AUTHORIZATION_TOKEN_INVALID',
])

type ResponseObject = {
  statusCode: number
  payload: {
    message: string
    errorCode: string | unknown
    details?: FreeformRecord
  }
}

function resolveLogObject(error: unknown): FreeformRecord {
  if (error instanceof InternalError) {
    return {
      message: error.message,
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
  if (error instanceof PublicNonRecoverableError) {
    return {
      statusCode: error.httpStatusCode ?? 500,
      payload: {
        message: error.message,
        errorCode: error.errorCode,
        details: error.details,
      },
    }
  }

  if (error instanceof ZodError) {
    return {
      statusCode: 400,
      payload: {
        message: 'Invalid params',
        errorCode: 'VALIDATION_ERROR',
        details: {
          error: error.issues,
        },
      },
    }
  }

  if (isStandardizedError(error)) {
    if (knownErrors.has(error.code)) {
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
  this: FastifyInstance,
  error: FreeformRecord,
  request: FastifyRequest,
  reply: FastifyReply,
): void {
  const logObject = resolveLogObject(error)
  request.log.error(logObject)

  if (error instanceof InternalError) {
    this.diContainer.cradle.errorReporter.report({ error })
  }

  const responseObject = resolveResponseObject(error)
  void reply.status(responseObject.statusCode).send(responseObject.payload)
}
