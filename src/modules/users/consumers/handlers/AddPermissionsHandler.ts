import type { Either } from '@lokalise/node-core'
import type { PreHandlingOutputs } from '@message-queue-toolkit/core'

import type { RequestContextPreHandlerOutput } from '../../../../infrastructure/prehandlers/requestContextPrehandler.js'
import type { PermissionsService } from '../../services/PermissionsService.js'
import type { UserService } from '../../services/UserService.js'
import type { AddPermissionsMessageType } from '../userConsumerSchemas.js'

export type AddPermissionsContext = {
  userService: UserService
  permissionsService: PermissionsService
}

export async function addPermissionsHandler(
  message: AddPermissionsMessageType,
  handlerContext: AddPermissionsContext,
  preHandlingOutputs: PreHandlingOutputs<RequestContextPreHandlerOutput, unknown>,
): Promise<Either<'retryLater', 'success'>> {
  const { requestContext } = preHandlingOutputs.preHandlerOutput
  const logger = requestContext.logger

  const projectUsers = await handlerContext.userService.getUsers(
    requestContext,
    message.payload.userIds,
  )

  if (!projectUsers || projectUsers.length < message.payload.userIds.length) {
    logger.info('Not all users already exist, try setting permissions again later')
    return {
      error: 'retryLater',
    }
  }

  // Do not do this in production, some kind of bulk insertion is needed here
  for (const user of projectUsers) {
    await handlerContext.permissionsService.setPermissions(
      requestContext,
      user.id,
      message.payload.permissions,
    )
  }

  return {
    result: 'success',
  }
}
