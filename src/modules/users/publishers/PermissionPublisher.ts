import { AbstractAmqpPublisher } from '@message-queue-toolkit/amqp'

import type { Dependencies } from '../../../infrastructure/diConfig'
import type { PERMISSIONS_MESSAGE_TYPE } from '../consumers/userConsumerSchemas'
import { PERMISSIONS_MESSAGE_SCHEMA } from '../consumers/userConsumerSchemas'

export class PermissionPublisher extends AbstractAmqpPublisher<PERMISSIONS_MESSAGE_TYPE> {
  public static QUEUE_NAME = 'user_permissions'

  constructor(dependencies: Dependencies) {
    super(
      {
        amqpConnection: dependencies.amqpConnection,
        errorReporter: dependencies.errorReporter,
        logger: dependencies.logger,
      },
      {
        queueName: PermissionPublisher.QUEUE_NAME,
        messageSchema: PERMISSIONS_MESSAGE_SCHEMA,
        messageTypeField: 'messageType',
        queueConfiguration: {
          autoDelete: false,
          durable: true,
          exclusive: false,
        },
      },
    )
  }
}
