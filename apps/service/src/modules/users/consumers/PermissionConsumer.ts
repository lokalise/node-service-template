import { MessageHandlerConfigBuilder } from '@message-queue-toolkit/core'
import type z from 'zod/v4'
import { AbstractRabbitMQTopicConsumer } from '../../../infrastructure/AbstractRabbitMQTopicConsumer.ts'
import type { RequestContextPreHandlerOutput } from '../../../infrastructure/prehandlers/requestContextPrehandler.ts'
import { createRequestContextPreHandler } from '../../../infrastructure/prehandlers/requestContextPrehandler.ts'
import type { PermissionsService } from '../services/PermissionsService.ts'
import type { UserService } from '../services/UserService.ts'
import type { UsersInjectableDependencies } from '../UserModule.ts'
import { addPermissionsHandler } from './handlers/AddPermissionsHandler.ts'
import { removePermissionsHandler } from './handlers/RemovePermissionsHandler.ts'
import {
  PERMISSIONS_EXCHANGE,
  PermissionsMessages,
  SERVICE_TEMPLATE_PERMISSIONS_QUEUE,
} from './permissionsMessageSchemas.ts'

type SupportedMessages =
  | z.infer<typeof PermissionsMessages.added.consumerSchema>
  | z.infer<typeof PermissionsMessages.removed.consumerSchema>

type ExecutionContext = {
  userService: UserService
  permissionsService: PermissionsService
}

export class PermissionConsumer extends AbstractRabbitMQTopicConsumer<
  SupportedMessages,
  ExecutionContext
> {
  public static readonly QUEUE_NAME = SERVICE_TEMPLATE_PERMISSIONS_QUEUE
  public static readonly EXCHANGE_NAME = PERMISSIONS_EXCHANGE

  constructor(dependencies: UsersInjectableDependencies) {
    super(
      dependencies,
      {
        queueConfig: {
          exchangeName: PermissionConsumer.EXCHANGE_NAME,
          queueName: PermissionConsumer.QUEUE_NAME,
          amqpOptions: {
            autoDelete: false,
            durable: true,
            exclusive: false,
          },
        },
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
      },
      {
        userService: dependencies.userService,
        permissionsService: dependencies.permissionsService,
      },
    )
  }
}
