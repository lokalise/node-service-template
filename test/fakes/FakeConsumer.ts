import { AbstractAmqpConsumer } from '@message-queue-toolkit/amqp'
import { MessageHandlerConfigBuilder } from '@message-queue-toolkit/core'
import type { ZodType } from 'zod'

import type { Dependencies } from '../../src/infrastructure/diConfig'
import { PERMISSIONS_ADD_MESSAGE_SCHEMA } from '../../src/modules/users/consumers/userConsumerSchemas'

export class FakeConsumer<T extends object> extends AbstractAmqpConsumer<T, unknown> {
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
        messageTypeField: 'messageType',
        handlers: new MessageHandlerConfigBuilder<T, unknown>()
          .addConfig(messageSchema, () => Promise.resolve({ result: 'success' }))
          .build(),
      },
      undefined,
    )
  }
}
