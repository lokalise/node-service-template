import { AbstractAmqpQueueConsumer } from '@message-queue-toolkit/amqp'
import { MessageHandlerConfigBuilder } from '@message-queue-toolkit/core'

import { isTest } from '../../../infrastructure/config.js'
import type { RequestContextPreHandlerOutput } from '../../../infrastructure/prehandlers/requestContextPrehandler.js'
import { createRequestContextPreHandler } from '../../../infrastructure/prehandlers/requestContextPrehandler.js'
import type { PermissionsService } from '../services/PermissionsService.js'
import type { UserService } from '../services/UserService.js'
import type { UsersInjectableDependencies } from '../userDiConfig.js'
import { PermissionsMessages } from './permissionsMessageShemas.js'

import type z from 'zod'
import { addPermissionsHandler } from './handlers/AddPermissionsHandler.js'
import { removePermissionsHandler } from './handlers/RemovePermissionsHandler.js'
import { PERMISSIONS_QUEUE } from './permissionsMessageShemas'

type SupportedMessages =
  | z.infer<typeof PermissionsMessages.added.consumerSchema>
  | z.infer<typeof PermissionsMessages.removed.consumerSchema>
type ExecutionContext = {
  userService: UserService
  permissionsService: PermissionsService
}

export class PermissionConsumer extends AbstractAmqpQueueConsumer<
  SupportedMessages,
  ExecutionContext,
  RequestContextPreHandlerOutput
> {
  public static readonly QUEUE_NAME = PERMISSIONS_QUEUE

  constructor(dependencies: UsersInjectableDependencies) {
    super(
      {
        amqpConnectionManager: dependencies.amqpConnectionManager,
        consumerErrorResolver: dependencies.consumerErrorResolver,
        errorReporter: dependencies.errorReporter,
        logger: dependencies.logger,
        transactionObservabilityManager: dependencies.transactionObservabilityManager,
      },
      {
        creationConfig: {
          queueName: PermissionConsumer.QUEUE_NAME,
          queueOptions: {
            autoDelete: false,
            durable: true,
            exclusive: false,
          },
        },
        deletionConfig: {
          deleteIfExists: isTest(),
        },
        logMessages: true,
        handlerSpy: isTest(),
        handlers: new MessageHandlerConfigBuilder<
          SupportedMessages,
          ExecutionContext,
          RequestContextPreHandlerOutput
        >()
          .addConfig(PermissionsMessages.added.consumerSchema, addPermissionsHandler, {
            preHandlers: [createRequestContextPreHandler(dependencies.logger)],
          })
          .addConfig(PermissionsMessages.removed.consumerSchema, removePermissionsHandler)
          .build(),
        messageTypeField: 'type',
      },
      {
        userService: dependencies.userService,
        permissionsService: dependencies.permissionsService,
      },
    )
  }
}
