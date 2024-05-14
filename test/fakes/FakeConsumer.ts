import { AbstractAmqpConsumer } from '@message-queue-toolkit/amqp'
import { MessageHandlerConfigBuilder } from '@message-queue-toolkit/core'
import type { ZodType } from 'zod'

import type { Dependencies } from '../../src/infrastructure/parentDiConfig.js'
import { PERMISSIONS_ADD_MESSAGE_SCHEMA } from '../../src/modules/users/consumers/userConsumerSchemas.js'

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
        transactionObservabilityManager: dependencies.transactionObservabilityManager,
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
        messageTypeField: 'type',
        handlers: new MessageHandlerConfigBuilder<T, unknown>()
          .addConfig(messageSchema, () => Promise.resolve({ result: 'success' }))
          .build(),
      },
      undefined,
    )
  }
}
