import type { MessageHandlerConfig } from '@message-queue-toolkit/core'
import {
  AbstractSnsSqsConsumer as AbstractSnsSqsConsumerBase,
  generateFilterAttributes,
} from '@message-queue-toolkit/sns'
import type { PublicDependencies } from 'opinionated-machine'
import type { RequestContextPreHandlerOutput } from './prehandlers/requestContextPrehandler.ts'

export type SnsConsumerDependencies = Pick<
  PublicDependencies,
  | 'sqsClient'
  | 'snsClient'
  | 'stsClient'
  | 'config'
  | 'errorReporter'
  | 'transactionObservabilityManager'
  | 'messageProcessingMetricsManager'
  | 'logger'
  | 'snsConsumerErrorResolver'
>

export interface SnsConsumerQueueConfig {
  queueName: string
  topicName: string
}

export interface SnsConsumerOptions<
  MessagePayloadType extends object,
  ExecutionContext,
  PrehandlerOutput = Record<string, never>,
> {
  queueConfig: SnsConsumerQueueConfig
  handlers: MessageHandlerConfig<MessagePayloadType, ExecutionContext, PrehandlerOutput>[]
}

export abstract class AbstractSnsSqsConsumer<
  MessagePayloadType extends object,
  ExecutionContext,
  PrehandlerOutput = RequestContextPreHandlerOutput,
> extends AbstractSnsSqsConsumerBase<MessagePayloadType, ExecutionContext, PrehandlerOutput> {
  constructor(
    dependencies: SnsConsumerDependencies,
    options: SnsConsumerOptions<MessagePayloadType, ExecutionContext, PrehandlerOutput>,
    executionContext: ExecutionContext,
  ) {
    const isTest = dependencies.config.app.nodeEnv === 'test'
    super(
      {
        sqsClient: dependencies.sqsClient,
        snsClient: dependencies.snsClient,
        stsClient: dependencies.stsClient,
        consumerErrorResolver: dependencies.snsConsumerErrorResolver,
        errorReporter: dependencies.errorReporter,
        logger: dependencies.logger,
        transactionObservabilityManager: dependencies.transactionObservabilityManager,
        messageMetricsManager: dependencies.messageProcessingMetricsManager,
      },
      {
        // Terraform owns the topic, queue, DLQ, queue policy and subscription (infra/<env>/sns-sqs.tf),
        // so they are only located, and startup fails if one is missing. The subscription filter
        // policy is the one attribute the consumer still writes, derived from its handlers.
        locatorConfig: {
          topicName: options.queueConfig.topicName,
          queueName: options.queueConfig.queueName,
        },
        subscriptionConfig: {
          locateOnly: true,
          managedAttributes: ['FilterPolicy', 'FilterPolicyScope'],
          Attributes: generateFilterAttributes(
            options.handlers.map((handler) => handler.schema),
            'type',
          ),
        },
        handlers: options.handlers,
        deletionConfig: {
          deleteIfExists: false,
        },
        messageTypeResolver: {
          messageTypePath: 'type',
        },
        handlerSpy: isTest ? { bufferSize: 100, messageIdField: 'id' } : false,
        logMessages: !isTest,
      },
      executionContext,
    )
  }
}
