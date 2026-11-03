import { MessageHandlerConfigBuilder } from '@message-queue-toolkit/core'
import type z from 'zod/v4'
import { AbstractSnsSqsConsumer } from '../../../infrastructure/AbstractSnsSqsConsumer.ts'
import type { RequestContextPreHandlerOutput } from '../../../infrastructure/prehandlers/requestContextPrehandler.ts'
import { createRequestContextPreHandler } from '../../../infrastructure/prehandlers/requestContextPrehandler.ts'
import type { UsersInjectableDependencies } from '../UserModule.ts'
import { handleUserCreatedEvent } from './handlers/HandleUserCreatedEvent.ts'
import {
  SERVICE_TEMPLATE_USER_EVENTS_QUEUE,
  USER_EVENTS_TOPIC,
  UserEventMessages,
} from './userEventMessageSchemas.ts'

type SupportedMessages = z.infer<typeof UserEventMessages.created.consumerSchema>

type ExecutionContext = Record<string, never>

export class UserEventConsumer extends AbstractSnsSqsConsumer<SupportedMessages, ExecutionContext> {
  public static readonly QUEUE_NAME = SERVICE_TEMPLATE_USER_EVENTS_QUEUE
  public static readonly TOPIC_NAME = USER_EVENTS_TOPIC

  constructor(dependencies: UsersInjectableDependencies) {
    super(
      dependencies,
      {
        queueConfig: {
          queueName: UserEventConsumer.QUEUE_NAME,
          topicName: UserEventConsumer.TOPIC_NAME,
        },
        handlers: new MessageHandlerConfigBuilder<
          SupportedMessages,
          ExecutionContext,
          RequestContextPreHandlerOutput
        >()
          .addConfig(UserEventMessages.created.consumerSchema, handleUserCreatedEvent, {
            preHandlers: [createRequestContextPreHandler(dependencies.logger)],
          })
          .build(),
      },
      {},
    )
  }
}
