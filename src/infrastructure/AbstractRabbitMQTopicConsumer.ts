import { AbstractAmqpTopicConsumer, type AMQPQueueConfig } from '@message-queue-toolkit/amqp'
import type { MessageHandlerConfig } from '@message-queue-toolkit/core'
import type { CommonDependencies } from './CommonModule.ts'
import type { RequestContextPreHandlerOutput } from './prehandlers/requestContextPrehandler.ts'

export type CommonConsumerDependencies = Pick<
  CommonDependencies,
  | 'amqpConnectionManager'
  | 'config'
  | 'errorReporter'
  | 'transactionObservabilityManager'
  | 'messageProcessingMetricsManager'
  | 'logger'
  | 'consumerErrorResolver'
>

export interface CommonQueueConfig {
  queueName: string
  exchangeName: string
  amqpOptions: AMQPQueueConfig
}

export interface CommonConsumerOptions<
  MessagePayloadType extends object,
  ExecutionContext,
  PrehandlerOutput = Record<string, never>,
> {
  queueConfig: CommonQueueConfig
  handlers: MessageHandlerConfig<MessagePayloadType, ExecutionContext, PrehandlerOutput>[]
}

export abstract class AbstractRabbitMQTopicConsumer<
  MessagePayloadType extends object,
  ExecutionContext,
  PrehandlerOutput = RequestContextPreHandlerOutput,
> extends AbstractAmqpTopicConsumer<MessagePayloadType, ExecutionContext, PrehandlerOutput> {
  constructor(
    dependencies: CommonConsumerDependencies,
    options: CommonConsumerOptions<MessagePayloadType, ExecutionContext, PrehandlerOutput>,
    executionContext: ExecutionContext,
  ) {
    const isTest = dependencies.config.app.nodeEnv === 'test'
    super(
      {
        amqpConnectionManager: dependencies.amqpConnectionManager,
        consumerErrorResolver: dependencies.consumerErrorResolver,
        errorReporter: dependencies.errorReporter,
        logger: dependencies.logger,
        transactionObservabilityManager: dependencies.transactionObservabilityManager,
        messageMetricsManager: dependencies.messageProcessingMetricsManager,
      },
      {
        creationConfig: {
          exchange: options.queueConfig.exchangeName,
          queueName: options.queueConfig.queueName,
          queueOptions: {
            autoDelete: options.queueConfig.amqpOptions.autoDelete ?? false,
            durable: options.queueConfig.amqpOptions.durable ?? true,
            exclusive: options.queueConfig.amqpOptions.exclusive ?? false,
          },
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
