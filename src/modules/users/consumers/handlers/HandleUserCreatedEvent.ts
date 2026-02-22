import type { Either } from '@lokalise/node-core'
import type { PreHandlingOutputs } from '@message-queue-toolkit/core'
import type z from 'zod/v4'
import type { RequestContextPreHandlerOutput } from '../../../../infrastructure/prehandlers/requestContextPrehandler.ts'
import type { UserEventMessages } from '../userEventMessageSchemas.ts'

export function handleUserCreatedEvent(
  message: z.infer<typeof UserEventMessages.created.consumerSchema>,
  _handlerContext: Record<string, never>,
  preHandlingOutputs: PreHandlingOutputs<RequestContextPreHandlerOutput, unknown>,
): Either<'retryLater', 'success'> {
  const { requestContext } = preHandlingOutputs.preHandlerOutput
  requestContext.logger.info({ userId: message.payload.userId }, 'Received user.created event')

  return {
    result: 'success',
  }
}
