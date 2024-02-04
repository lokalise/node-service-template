import type { Either } from '@lokalise/node-core'
import { AbstractAmqpConsumerMonoSchema } from '@message-queue-toolkit/amqp'
import type { ZodType } from 'zod'

import type { CommonMessage } from '../../src/infrastructure/amqp/MessageTypes.js'
import type { Dependencies } from '../../src/infrastructure/diConfig.js'
import { PERMISSIONS_ADD_MESSAGE_SCHEMA } from '../../src/modules/users/consumers/userConsumerSchemas.js'

export class FakeConsumer extends AbstractAmqpConsumerMonoSchema<CommonMessage> {
  constructor(
    dependencies: Dependencies,
    queueName = 'dummy',
    messageSchema: ZodType = PERMISSIONS_ADD_MESSAGE_SCHEMA,
  ) {
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
