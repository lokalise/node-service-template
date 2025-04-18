import { AbstractAmqpTopicConsumer } from '@message-queue-toolkit/amqp'
import { MessageHandlerConfigBuilder } from '@message-queue-toolkit/core'

import { isTest } from '../../../infrastructure/config.ts'
import type { RequestContextPreHandlerOutput } from '../../../infrastructure/prehandlers/requestContextPrehandler.ts'
import { createRequestContextPreHandler } from '../../../infrastructure/prehandlers/requestContextPrehandler.ts'
import type { PermissionsService } from '../services/PermissionsService.ts'
import type { UserService } from '../services/UserService.ts'
import {
  PERMISSIONS_EXCHANGE,
  PermissionsMessages,
  SERVICE_TEMPLATE_PERMISSIONS_QUEUE,
} from './permissionsMessageSchemas.ts'

import type z from 'zod'
import type { UsersInjectableDependencies } from '../UserModule.ts'
import { addPermissionsHandler } from './handlers/AddPermissionsHandler.ts'
import { removePermissionsHandler } from './handlers/RemovePermissionsHandler.ts'

type SupportedMessages =
  | z.infer<typeof PermissionsMessages.added.consumerSchema>
  | z.infer<typeof PermissionsMessages.removed.consumerSchema>
type ExecutionContext = {
  userService: UserService
  permissionsService: PermissionsService
}

export class PermissionConsumer extends AbstractAmqpTopicConsumer<
  SupportedMessages,
  ExecutionContext,
  RequestContextPreHandlerOutput
> {
  public static readonly QUEUE_NAME = SERVICE_TEMPLATE_PERMISSIONS_QUEUE
  public static readonly EXCHANGE_NAME = PERMISSIONS_EXCHANGE

  constructor(dependencies: UsersInjectableDependencies) {
    super(
      {
        amqpConnectionManager: dependencies.amqpConnectionManager,
        consumerErrorResolver: dependencies.consumerErrorResolver,
        errorReporter: dependencies.errorReporter,
        logger: dependencies.logger,
        transactionObservabilityManager: dependencies.transactionObservabilityManager,
        messageMetricsManager: dependencies.messageProcessingMetricsManager,
      },
      {
        creationConfig: {
          exchange: PermissionConsumer.EXCHANGE_NAME,
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
