import { AbstractAmqpPublisher } from '@message-queue-toolkit/amqp'

import { isTest } from '../../../infrastructure/config.js'
import type {
  AddPermissionsMessageType,
  RemovePermissionsMessageType,
} from '../consumers/userConsumerSchemas.js'
import {
  PERMISSIONS_ADD_MESSAGE_SCHEMA,
  PERMISSIONS_REMOVE_MESSAGE_SCHEMA,
} from '../consumers/userConsumerSchemas.js'
import type { UsersInjectableDependencies } from '../userDiConfig.js'

type SupportedMessages = RemovePermissionsMessageType | AddPermissionsMessageType

export class PermissionPublisher extends AbstractAmqpPublisher<SupportedMessages> {
  public static QUEUE_NAME = 'user_permissions'

  constructor(dependencies: UsersInjectableDependencies) {
    super(
      {
        amqpConnectionManager: dependencies.amqpConnectionManager,
        errorReporter: dependencies.errorReporter,
        logger: dependencies.logger,
      },
      {
        creationConfig: {
          queueName: PermissionPublisher.QUEUE_NAME,
          queueOptions: {
            autoDelete: false,
            durable: true,
            exclusive: false,
          },
        },
        handlerSpy: isTest(),
        messageSchemas: [PERMISSIONS_ADD_MESSAGE_SCHEMA, PERMISSIONS_REMOVE_MESSAGE_SCHEMA],
        messageTypeField: 'messageType',
      },
    )
  }
}
