import { AbstractAmqpPublisherMultiSchema } from '@message-queue-toolkit/amqp'

import { isTest } from '../../../infrastructure/config'
import type {
  PERMISSIONS_ADD_MESSAGE_TYPE,
  PERMISSIONS_REMOVE_MESSAGE_TYPE,
} from '../consumers/userConsumerSchemas'
import {
  PERMISSIONS_ADD_MESSAGE_SCHEMA,
  PERMISSIONS_REMOVE_MESSAGE_SCHEMA,
} from '../consumers/userConsumerSchemas'
import type { UsersInjectableDependencies } from '../diConfig'

type SupportedMessages = PERMISSIONS_REMOVE_MESSAGE_TYPE | PERMISSIONS_ADD_MESSAGE_TYPE

export class PermissionPublisher extends AbstractAmqpPublisherMultiSchema<SupportedMessages> {
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
