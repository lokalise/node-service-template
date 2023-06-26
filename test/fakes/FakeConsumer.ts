import type { Either } from '@lokalise/node-core'
import { AbstractAmqpConsumer } from '@message-queue-toolkit/amqp'
import type { ZodType } from 'zod'

import type { CommonMessage } from '../../src/infrastructure/amqp/MessageTypes'
import type { Dependencies } from '../../src/infrastructure/diConfig'
import { PERMISSIONS_MESSAGE_SCHEMA } from '../../src/modules/users/consumers/userConsumerSchemas'

export class FakeConsumer extends AbstractAmqpConsumer<CommonMessage> {
  constructor(
    dependencies: Dependencies,
    queueName = 'dummy',
    messageSchema: ZodType = PERMISSIONS_MESSAGE_SCHEMA,
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
        queueName,
        messageSchema,
        messageTypeField: 'messageType',
        queueConfiguration: {
          autoDelete: false,
          durable: true,
          exclusive: false,
        },
      },
    )
  }

  processMessage(): Promise<Either<'retryLater', 'success'>> {
    return Promise.resolve({
      result: 'success',
    })
  }
}
