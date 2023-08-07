import type { Either } from '@lokalise/node-core'
import { AbstractAmqpConsumer } from '@message-queue-toolkit/amqp'
import type { ZodType } from 'zod'

import type { CommonMessage } from '../../src/infrastructure/amqp/MessageTypes'
import type { Dependencies } from '../../src/infrastructure/diConfig'
import { PERMISSIONS_ADD_MESSAGE_SCHEMA } from '../../src/modules/users/consumers/userConsumerSchemas'

export class FakeConsumer extends AbstractAmqpConsumer<CommonMessage> {
  constructor(
    dependencies: Dependencies,
    queueName = 'dummy',
    messageSchema: ZodType = PERMISSIONS_ADD_MESSAGE_SCHEMA,
  ) {
    super(
      {
        amqpConnection: dependencies.amqpConnection,
        consumerErrorResolver: dependencies.consumerErrorResolver,
        errorReporter: dependencies.errorReporter,
        logger: dependencies.logger,
        transactionObservabilityManager: dependencies.newRelicBackgroundTransactionManager,
      },
      {
        creationConfig: {
          queueName,
          queueOptions: {
            autoDelete: false,
            durable: true,
            exclusive: false,
          },
        },
        messageSchema,
        messageTypeField: 'messageType',
      },
    )
  }

  processMessage(): Promise<Either<'retryLater', 'success'>> {
    return Promise.resolve({
      result: 'success',
    })
  }
}
