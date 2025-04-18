import { AbstractAmqpTopicConsumer } from '@message-queue-toolkit/amqp'
import { MessageHandlerConfigBuilder } from '@message-queue-toolkit/core'
import type { ZodType } from 'zod'

import type { Dependencies } from '../../src/infrastructure/CommonModule.ts'
import { PermissionsMessages } from '../../src/modules/users/consumers/permissionsMessageSchemas.ts'

export class FakeConsumer<T extends object> extends AbstractAmqpTopicConsumer<T, unknown> {
  constructor(
    dependencies: Dependencies,
    exchange = 'dummy',
    queueName = 'dummy',
    topicPattern = '',
    messageSchema: ZodType = PermissionsMessages.added.consumerSchema,
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
          exchange,
          topicPattern,
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
