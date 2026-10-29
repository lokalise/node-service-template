import {
  AmqpTopicPublisherManager,
  type CommonAmqpTopicPublisher,
  CommonAmqpTopicPublisherFactory,
} from '@message-queue-toolkit/amqp'
import { CommonMetadataFiller } from '@message-queue-toolkit/core'
import type {
  AmqpSupportedMessages,
  CommonDependencies,
  MessagesPublishPayloadsType,
} from './CommonModule.ts'
import { nodeEnv } from './config.ts'

export class PublisherManagerAdapter extends AmqpTopicPublisherManager<
  CommonAmqpTopicPublisher<MessagesPublishPayloadsType>,
  AmqpSupportedMessages
> {
  constructor(dependencies: CommonDependencies) {
    super(
      {
        errorReporter: dependencies.errorReporter,
        logger: dependencies.logger,
        amqpConnectionManager: dependencies.amqpConnectionManager,
        eventRegistry: dependencies.eventRegistry,
      },
      {
        metadataField: 'metadata',
        metadataFiller: new CommonMetadataFiller({
          serviceId: 'node-service-template',
          defaultVersion: '1.0.0',
        }),
        publisherFactory: new CommonAmqpTopicPublisherFactory(),
        newPublisherOptions: {
          messageTypeResolver: {
            messageTypePath: 'type',
          },
          messageIdField: 'id',
          logMessages: true,
          handlerSpy: nodeEnv.isTest,
          messageTimestampField: 'timestamp',
          deletionConfig: {
            deleteIfExists: false, // queue deletion/creation should be handled by consumers
          },
        },
      },
    )
  }
}
