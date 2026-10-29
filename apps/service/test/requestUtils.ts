import { randomUUID } from 'node:crypto'

import type { RequestContext } from '@lokalise/fastify-extras'
import { globalLogger } from '@lokalise/node-core'

export function createRequestContext(): RequestContext {
  return {
    reqId: randomUUID(),
    logger: globalLogger,
  }
}
