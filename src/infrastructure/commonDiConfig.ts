import type { JWT } from '@fastify/jwt'
import { type QueueConfiguration, QueueManager } from '@lokalise/background-jobs-common'
import { CommonBullmqFactoryNew } from '@lokalise/background-jobs-common'
import type { Amplitude } from '@lokalise/fastify-extras'
import { reportErrorToBugsnag } from '@lokalise/fastify-extras'
import {
  type Healthcheck,
  HealthcheckRefreshJob,
  HealthcheckResultsStore,
} from '@lokalise/healthcheck-utils'
import type {
  CommonLogger,
  ErrorReporter,
  ErrorResolver,
  TransactionObservabilityManager,
} from '@lokalise/node-core'
import { globalLogger } from '@lokalise/node-core'
import {
  type AmqpAwareEventDefinition,
  AmqpConnectionManager,
  AmqpConsumerErrorResolver,
  AmqpTopicPublisherManager,
  CommonAmqpTopicPublisherFactory,
} from '@message-queue-toolkit/amqp'
import type { CommonAmqpTopicPublisher } from '@message-queue-toolkit/amqp'
import { CommonMetadataFiller, EventRegistry } from '@message-queue-toolkit/core'
import type { NameAndRegistrationPair } from 'awilix'
import { Lifetime, asClass, asFunction } from 'awilix'
import type { AwilixManager } from 'awilix-manager'
import { drizzle } from 'drizzle-orm/postgres-js'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import { Redis } from 'ioredis'
import postgres from 'postgres'
import { ToadScheduler } from 'toad-scheduler'
import type z from 'zod'
import { FakeStoreApiClient } from '../integrations/FakeStoreApiClient.js'
import { PermissionsMessages } from '../modules/users/consumers/permissionsMessageSchemas.js'
import { userBullmqQueues } from '../modules/users/userDiConfig.js'
import { getAmqpConfig, getConfig, isTest } from './config.js'
import type { Config } from './config.js'
import {
  type DIOptions,
  isAmqpConsumerEnabled,
  isEnqueuedJobsEnabled,
  resolveEnqueuedJobQueuesEnabled,
} from './diConfigUtils.js'
import { FakeAmplitude } from './fakes/FakeAmplitude.js'
import {
  DbHealthcheck,
  HEALTHCHECK_TTL_IN_MSECS,
  RedisHealthcheck,
  STALENESS_THRESHOLD_IN_MSECS,
  type SupportedHealthchecks,
} from './healthchecks/healthchecks.js'
import { MessageProcessingMetricsManager } from './metrics/MessageProcessingMetricsManager.js'
import { SINGLETON_CONFIG } from './parentDiConfig.js'
import type { ExternalDependencies } from './parentDiConfig.js'

const amqpSupportedMessages = [
  ...Object.values(PermissionsMessages),
] as const satisfies AmqpAwareEventDefinition[]
type AmqpSupportedMessages = typeof amqpSupportedMessages

type MessagesPublishPayloadsType = z.infer<AmqpSupportedMessages[number]['publisherSchema']>

export type PublisherManager = AmqpTopicPublisherManager<
  CommonAmqpTopicPublisher<MessagesPublishPayloadsType>,
  AmqpSupportedMessages
>

const bullmqSupportedQueues = [...userBullmqQueues] as const satisfies QueueConfiguration[]
export type BullmqSupportedQueues = typeof bullmqSupportedQueues

export function resolveCommonDiConfig(
  dependencies: ExternalDependencies = { logger: globalLogger },
  options: DIOptions = {},
): NameAndRegistrationPair<CommonDependencies> {
  return {
    jwt: asFunction(() => {
      if (!dependencies.app) {
        throw new Error('app with JWT set is necessary to use JWT as a dependency')
      }
      return dependencies.app.jwt
    }, SINGLETON_CONFIG),
    logger: asFunction(() => dependencies.logger, SINGLETON_CONFIG),

    scheduler: asFunction(() => {
      return dependencies.app?.scheduler ?? new ToadScheduler()
    }, SINGLETON_CONFIG),

    awilixManager: asFunction(() => {
      if (!dependencies.app) {
        throw new Error(
          'app with awilixManager set is necessary to use awilixManager as a dependency',
        )
      }
      return dependencies.app?.awilixManager
    }, SINGLETON_CONFIG),

    redis: asFunction(
      ({ config }: CommonDependencies) => {
        const redisConfig = config.redis

        return new Redis({
          host: redisConfig.host,
          keyPrefix: redisConfig.keyPrefix,
          port: redisConfig.port,
          username: redisConfig.username,
          password: redisConfig.password,
          connectTimeout: redisConfig.connectTimeout,
          commandTimeout: redisConfig.commandTimeout,
          maxRetriesPerRequest: null,
          tls: redisConfig.useTls ? {} : undefined,
        })
      },
      {
        dispose: (redis) => {
          return new Promise((resolve) => {
            void redis.quit((_err, result) => {
              return resolve(result)
            })
          })
        },
        lifetime: Lifetime.SINGLETON,
      },
    ),

    redisPublisher: asFunction(
      ({ config }: CommonDependencies) => {
        const redisConfig = config.redis

        return new Redis({
          host: redisConfig.host,
          keyPrefix: redisConfig.keyPrefix,
          port: redisConfig.port,
          username: redisConfig.username,
          password: redisConfig.password,
          connectTimeout: redisConfig.connectTimeout,
          commandTimeout: redisConfig.commandTimeout,
          tls: redisConfig.useTls ? {} : undefined,
        })
      },
      {
        dispose: (redis) => {
          return new Promise((resolve) => {
            void redis.quit((_err, result) => {
              return resolve(result)
            })
          })
        },
        lifetime: Lifetime.SINGLETON,
      },
    ),

    redisConsumer: asFunction(
      ({ config }: CommonDependencies) => {
        const redisConfig = config.redis

        return new Redis({
          host: redisConfig.host,
          keyPrefix: redisConfig.keyPrefix,
          port: redisConfig.port,
          username: redisConfig.username,
          password: redisConfig.password,
          connectTimeout: redisConfig.connectTimeout,
          commandTimeout: redisConfig.commandTimeout,
          tls: redisConfig.useTls ? {} : undefined,
        })
      },
      {
        dispose: (redis) => {
          return new Promise((resolve) => {
            void redis.quit((_err, result) => {
              return resolve(result)
            })
          })
        },
        lifetime: Lifetime.SINGLETON,
      },
    ),

    drizzle: asFunction(
      ({ config }: CommonDependencies) => {
        const pg = postgres(config.db.databaseUrl)
        return drizzle(pg)
      },
      {
        dispose: (drizzle) => drizzle.$client.end(),
        lifetime: Lifetime.SINGLETON,
      },
    ),

    bullmqQueueManager: asFunction(
      (deps) =>
        new QueueManager(new CommonBullmqFactoryNew(), bullmqSupportedQueues, {
          redisConfig: deps.config.redis,
          isTest: isTest(),
          lazyInitEnabled: !isTest(),
        }),
      {
        ...SINGLETON_CONFIG,
        asyncInit: (manager) => manager.start(resolveEnqueuedJobQueuesEnabled(options)),
        asyncDispose: 'dispose',
        asyncDisposePriority: 20,
      },
    ),

    amqpConnectionManager: asFunction(
      () => {
        return new AmqpConnectionManager(getAmqpConfig(), dependencies.logger)
      },
      {
        lifetime: Lifetime.SINGLETON,
        asyncInit: 'init',
        asyncDispose: 'close',
        asyncDisposePriority: 1,
        enabled: isAmqpConsumerEnabled(options),
      },
    ),
    consumerErrorResolver: asFunction(() => {
      return new AmqpConsumerErrorResolver()
    }, SINGLETON_CONFIG),
    eventRegistry: asFunction(() => {
      return new EventRegistry(amqpSupportedMessages)
    }, SINGLETON_CONFIG),
    publisherManager: asFunction((dependencies: CommonDependencies) => {
      return new AmqpTopicPublisherManager<
        CommonAmqpTopicPublisher<MessagesPublishPayloadsType>,
        AmqpSupportedMessages
      >(
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
            messageTypeField: 'type',
            messageIdField: 'id',
            logMessages: true,
            handlerSpy: isTest(),
            messageTimestampField: 'timestamp',
            deletionConfig: {
              deleteIfExists: false, // queue deletion/creation should be handled by consumers
            },
          },
        },
      )
    }, SINGLETON_CONFIG),

    config: asFunction(() => {
      return getConfig()
    }, SINGLETON_CONFIG),

    // vendor-specific dependencies
    transactionObservabilityManager: asFunction(() => {
      if (!dependencies.app?.newrelicTransactionManager) {
        throw new Error('Observability manager is not set')
      }

      return dependencies.app?.newrelicTransactionManager
    }, SINGLETON_CONFIG),
    amplitude: asFunction(() => {
      return dependencies.app?.amplitude ?? new FakeAmplitude()
    }, SINGLETON_CONFIG),
    errorReporter: asFunction(() => {
      return {
        report: (report) => reportErrorToBugsnag(report),
      } satisfies ErrorReporter
    }, SINGLETON_CONFIG),
    fakeStoreApiClient: asClass(FakeStoreApiClient, SINGLETON_CONFIG),

    healthcheckRefreshJob: asFunction(
      (dependencies: CommonDependencies) => {
        return new HealthcheckRefreshJob(dependencies, dependencies.healthchecks)
      },
      {
        lifetime: Lifetime.SINGLETON,
        eagerInject: 'register',
        enabled: isEnqueuedJobsEnabled(options, HealthcheckRefreshJob.JOB_NAME),
      },
    ),

    dbHealthcheck: asClass(DbHealthcheck, SINGLETON_CONFIG),
    redisHealthcheck: asClass(RedisHealthcheck, SINGLETON_CONFIG),

    healthcheckStore: asFunction(() => {
      return new HealthcheckResultsStore({
        maxHealthcheckNumber: 10,
        stalenessThresholdInMsecs: STALENESS_THRESHOLD_IN_MSECS,
        healthCheckResultTtlInMsecs: HEALTHCHECK_TTL_IN_MSECS,
      })
    }, SINGLETON_CONFIG),

    healthchecks: asFunction((dependencies: CommonDependencies) => {
      return [dependencies.redisHealthcheck, dependencies.dbHealthcheck]
    }, SINGLETON_CONFIG),

    messageProcessingMetricsManager: asFunction(
      () =>
        dependencies.app?.metrics
          ? new MessageProcessingMetricsManager(dependencies.app.metrics)
          : undefined,
      SINGLETON_CONFIG,
    ),
  }
}

export type CommonDependencies = {
  jwt: JWT
  config: Config
  logger: CommonLogger
  scheduler: ToadScheduler
  awilixManager: AwilixManager

  redis: Redis
  redisPublisher: Redis
  redisConsumer: Redis
  drizzle: PostgresJsDatabase

  bullmqQueueManager: QueueManager<BullmqSupportedQueues>

  amqpConnectionManager: AmqpConnectionManager

  // vendor-specific dependencies
  transactionObservabilityManager: TransactionObservabilityManager
  amplitude: Amplitude

  eventRegistry: EventRegistry<AmqpSupportedMessages>
  publisherManager: PublisherManager
  errorReporter: ErrorReporter
  consumerErrorResolver: ErrorResolver

  fakeStoreApiClient: FakeStoreApiClient
  healthcheckRefreshJob: HealthcheckRefreshJob
  redisHealthcheck: RedisHealthcheck
  dbHealthcheck: DbHealthcheck
  healthcheckStore: HealthcheckResultsStore<SupportedHealthchecks>
  healthchecks: readonly Healthcheck[]

  messageProcessingMetricsManager?: MessageProcessingMetricsManager
}
