import type { RequestContext } from '@lokalise/fastify-extras'
import type { CommonLogger } from '@lokalise/node-core'
import type { BaseMessageType, Prehandler } from '@message-queue-toolkit/core'

export type RequestContextPreHandlerOutput = {
  requestContext: RequestContext
}

export function createRequestContextPreHandler(
  logger: CommonLogger,
): Prehandler<BaseMessageType, unknown, RequestContextPreHandlerOutput> {
  return (event, _context, outputs, next) => {
    outputs.requestContext = {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      reqId: event.metadata!.correlationId,
      logger: logger.child({
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        'x-request-id': event.metadata!.correlationId,
      }),
    }
    next({
      result: 'success',
    })
  }
}
