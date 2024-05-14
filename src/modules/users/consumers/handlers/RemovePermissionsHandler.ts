import type { Either } from '@lokalise/node-core'
import type { PreHandlingOutputs } from '@message-queue-toolkit/core'

import type { RequestContextPreHandlerOutput } from '../../../../infrastructure/prehandlers/requestContextPrehandler.js'
import type { RemovePermissionsMessageType } from '../userConsumerSchemas.js'

export function removePermissionsHandler(
  _message: RemovePermissionsMessageType,
  _handlerContext: unknown,
  _preHandlingOutputs: PreHandlingOutputs<RequestContextPreHandlerOutput, unknown>,
): Promise<Either<'retryLater', 'success'>> {
  throw new Error('Not implemented yet')
}
