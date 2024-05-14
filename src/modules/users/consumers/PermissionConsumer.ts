import { AbstractAmqpConsumer } from '@message-queue-toolkit/amqp'
import { MessageHandlerConfigBuilder } from '@message-queue-toolkit/core'

import { isTest } from '../../../infrastructure/config.js'
import type { RequestContextPreHandlerOutput } from '../../../infrastructure/prehandlers/requestContextPrehandler.js'
import { createRequestContextPreHandler } from '../../../infrastructure/prehandlers/requestContextPrehandler.js'
import type { PermissionsService } from '../services/PermissionsService.js'
import type { UserService } from '../services/UserService.js'
import type { UsersInjectableDependencies } from '../userDiConfig.js'

import { addPermissionsHandler } from './handlers/AddPermissionsHandler.js'
import { removePermissionsHandler } from './handlers/RemovePermissionsHandler.js'
import type {
  AddPermissionsMessageType,
  RemovePermissionsMessageType,
} from './userConsumerSchemas.js'
import {
  PERMISSIONS_REMOVE_MESSAGE_SCHEMA,
  PERMISSIONS_ADD_MESSAGE_SCHEMA,
} from './userConsumerSchemas.js'

type SupportedMessages = RemovePermissionsMessageType | AddPermissionsMessageType
type ExecutionContext = {
  userService: UserService
  permissionsService: PermissionsService
}

export class PermissionConsumer extends AbstractAmqpConsumer<
  SupportedMessages,
  ExecutionContext,
  RequestContextPreHandlerOutput
> {
  public static readonly QUEUE_NAME = 'user_permissions'

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
          .addConfig(PERMISSIONS_ADD_MESSAGE_SCHEMA, addPermissionsHandler, {
            preHandlers: [createRequestContextPreHandler(dependencies.logger)],
          })
          .addConfig(PERMISSIONS_REMOVE_MESSAGE_SCHEMA, removePermissionsHandler)
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
