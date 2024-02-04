import { AbstractAmqpConsumerMultiSchema } from '@message-queue-toolkit/amqp'
import { MessageHandlerConfigBuilder } from '@message-queue-toolkit/core'

import { isTest } from '../../../infrastructure/config.js'
import type { UsersInjectableDependencies } from '../diConfig.js'
import type { PermissionsService } from '../services/PermissionsService.js'
import type { UserService } from '../services/UserService.js'

import type {
  PERMISSIONS_ADD_MESSAGE_TYPE,
  PERMISSIONS_REMOVE_MESSAGE_TYPE,
} from './userConsumerSchemas.js'
import {
  PERMISSIONS_REMOVE_MESSAGE_SCHEMA,
  PERMISSIONS_ADD_MESSAGE_SCHEMA,
} from './userConsumerSchemas.js'

type SupportedMessages = PERMISSIONS_REMOVE_MESSAGE_TYPE | PERMISSIONS_ADD_MESSAGE_TYPE
type ExecutionContext = {
  userService: UserService
  permissionsService: PermissionsService
}

export class PermissionConsumer extends AbstractAmqpConsumerMultiSchema<
  SupportedMessages,
  ExecutionContext
> {
  public static QUEUE_NAME = 'user_permissions'

  constructor(dependencies: UsersInjectableDependencies) {
    super(
      {
        amqpConnectionManager: dependencies.amqpConnectionManager,
        consumerErrorResolver: dependencies.consumerErrorResolver,
        errorReporter: dependencies.errorReporter,
        logger: dependencies.logger,
        transactionObservabilityManager: dependencies.newRelicBackgroundTransactionManager,
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
        handlerSpy: isTest(),
        handlers: new MessageHandlerConfigBuilder<SupportedMessages, ExecutionContext>()
          .addConfig(PERMISSIONS_ADD_MESSAGE_SCHEMA, async (message, context) => {
            const projectUsers = await context.userService.getUsers(message.userIds)

            if (!projectUsers || projectUsers.length < message.userIds.length) {
              // not all users were already created, we need to wait to be able to set permissions
              return {
                error: 'retryLater',
              }
            }

            // Do not do this in production, some kind of bulk insertion is needed here
            for (const user of projectUsers) {
              await context.permissionsService.setPermissions(user.id, message.permissions)
            }

            return {
              result: 'success',
            }
          })
          .addConfig(PERMISSIONS_REMOVE_MESSAGE_SCHEMA, (_message, _context) => {
            throw new Error('Not implemented yet')
          })
          .build(),
        messageTypeField: 'messageType',
      },
      {
        userService: dependencies.userService,
        permissionsService: dependencies.permissionsService,
      },
    )
  }
}
