import { AbstractAmqpConsumer } from '@message-queue-toolkit/amqp'
import { MessageHandlerConfigBuilder } from '@message-queue-toolkit/core'
import { undefined, ZodType } from "zod";

import type { Dependencies } from '../../src/infrastructure/parentDiConfig.js'
import { PermissionsMessages } from "../../src/modules/users/consumers/permissionsMessageShemas";

export class FakeConsumer<T extends object> extends AbstractAmqpConsumer<T, unknown> {
  constructor(
    dependencies: Dependencies,
    queueName = 'dummy',
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

  protected createMissingEntities(): Promise<void> {
    return Promise.resolve();
  }
}
