import { AbstractPublisher } from '../../../infrastructure/amqp/AbstractPublisher'
import type { Dependencies } from '../../../infrastructure/diConfig'
import type { PERMISSIONS_MESSAGE_TYPE } from '../consumers/userConsumerSchemas'
import { PERMISSIONS_MESSAGE_SCHEMA } from '../consumers/userConsumerSchemas'

export class PermissionPublisher extends AbstractPublisher<PERMISSIONS_MESSAGE_TYPE> {
  public static QUEUE_NAME = 'user_permissions'

  constructor(dependencies: Dependencies) {
    super(
      {
        queueName: PermissionPublisher.QUEUE_NAME,
        messageSchema: PERMISSIONS_MESSAGE_SCHEMA,
      },
      dependencies,
    )
  }
}
