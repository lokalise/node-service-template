import type { Either } from '@lokalise/node-core'
import type { PreHandlingOutputs } from '@message-queue-toolkit/core'

import type z from 'zod'
import type { RequestContextPreHandlerOutput } from '../../../../infrastructure/prehandlers/requestContextPrehandler.ts'
import type { PermissionsMessages } from '../permissionsMessageSchemas.ts'

export function removePermissionsHandler(
  _message: z.infer<typeof PermissionsMessages.removed.consumerSchema>,
  _handlerContext: unknown,
  _preHandlingOutputs: PreHandlingOutputs<RequestContextPreHandlerOutput, unknown>,
): Promise<Either<'retryLater', 'success'>> {
  throw new Error('Not implemented yet')
}
