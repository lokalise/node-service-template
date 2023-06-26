import type { Either } from '@lokalise/node-core'
import { AbstractAmqpConsumer } from '@message-queue-toolkit/amqp'

import type { Dependencies } from '../../../infrastructure/diConfig'
import type { PermissionsService } from '../services/PermissionsService'
import type { UserService } from '../services/UserService'

import type { PERMISSIONS_MESSAGE_TYPE } from './userConsumerSchemas'
import { PERMISSIONS_MESSAGE_SCHEMA } from './userConsumerSchemas'

export class PermissionConsumer extends AbstractAmqpConsumer<PERMISSIONS_MESSAGE_TYPE> {
  public static QUEUE_NAME = 'user_permissions'
  private readonly userService: UserService
  private readonly permissionsService: PermissionsService

  constructor(dependencies: Dependencies) {
    super(
      {
        amqpConnection: dependencies.amqpConnection,
        consumerErrorResolver: dependencies.consumerErrorResolver,
        errorReporter: dependencies.errorReporter,
        logger: dependencies.logger,
        transactionObservabilityManager: dependencies.newRelicBackgroundTransactionManager,
      },
      {
        queueName: PermissionConsumer.QUEUE_NAME,
        messageSchema: PERMISSIONS_MESSAGE_SCHEMA,
        messageTypeField: 'messageType',
        queueConfiguration: {
          autoDelete: false,
          durable: true,
          exclusive: false,
        },
      },
    )
    this.userService = dependencies.userService
    this.permissionsService = dependencies.permissionsService
  }

  override async processMessage(
    message: PERMISSIONS_MESSAGE_TYPE,
  ): Promise<Either<'retryLater', 'success'>> {
    const projectUsers = await this.userService.getUsers(message.userIds)

    if (!projectUsers || projectUsers.length < message.userIds.length) {
      // not all users were already created, we need to wait to be able to set permissions
      return {
        error: 'retryLater',
      }
    }

    // Do not do this in production, some kind of bulk insertion is needed here
    for (const user of projectUsers) {
      await this.permissionsService.setPermissions(user.id, message.permissions)
    }

    return {
      result: 'success',
    }
  }
}
