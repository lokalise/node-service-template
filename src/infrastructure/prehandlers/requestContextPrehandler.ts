import { randomUUID } from 'node:crypto'

import type { RequestContext } from '@lokalise/fastify-extras'
import type { CommonLogger } from '@lokalise/node-core'
import type { ConsumerBaseMessageType, Prehandler } from '@message-queue-toolkit/core'

export type RequestContextPreHandlerOutput = {
  requestContext: RequestContext
}

export function createRequestContextPreHandler(
  logger: CommonLogger,
): Prehandler<ConsumerBaseMessageType, unknown, RequestContextPreHandlerOutput> {
  return (event, _context, outputs, next) => {
    const correlationId = event.metadata?.correlationId ?? randomUUID()

    outputs.requestContext = {
      reqId: correlationId,
      logger: logger.child({
        'x-request-id': correlationId,
      }),
    }
    next({
      result: 'success',
    })
  }
}
