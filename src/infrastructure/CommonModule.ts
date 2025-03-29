import type { JWT } from '@fastify/jwt'
import {
  CommonBullmqFactoryNew,
  type QueueConfiguration,
  QueueManager,
} from '@lokalise/background-jobs-common'
import { type Amplitude, reportErrorToBugsnag } from '@lokalise/fastify-extras'
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
import {
  type AmqpAwareEventDefinition,
  AmqpConnectionManager,
  AmqpConsumerErrorResolver,
  AmqpTopicPublisherManager,
  type CommonAmqpTopicPublisher,
  CommonAmqpTopicPublisherFactory,
} from '@message-queue-toolkit/amqp'
import { CommonMetadataFiller, EventRegistry } from '@message-queue-toolkit/core'
import type { Connection } from 'amqplib'
import { Lifetime, type NameAndRegistrationPair, asClass, asFunction } from 'awilix'
import type { AwilixManager } from 'awilix-manager'
import { drizzle } from 'drizzle-orm/postgres-js'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import { Redis } from 'ioredis'
import {
  AbstractModule,
  type DependencyInjectionOptions,
  asSingletonFunction,
  isAnyMessageQueueConsumerEnabled,
  isJobWorkersEnabled,
  resolveJobQueuesEnabled,
} from 'opinionated-machine'
import postgres from 'postgres'
import { ToadScheduler } from 'toad-scheduler'
import type { z } from 'zod'
import type { AppInstance } from '../app.js'
import { FakeStoreApiClient } from '../integrations/FakeStoreApiClient.js'
import { type UsersModuleDependencies, userBullmqQueues } from '../modules/users/UserModule.js'
import { PermissionsMessages } from '../modules/users/consumers/permissionsMessageSchemas.js'
import { getAmqpConfig, getConfig, isTest } from './config.js'
import type { Config } from './config.js'
import { FakeAmplitude } from './fakes/FakeAmplitude.js'
import {
  DbHealthcheck,
  HEALTHCHECK_TTL_IN_MSECS,
  RedisHealthcheck,
  STALENESS_THRESHOLD_IN_MSECS,
  type SupportedHealthchecks,
} from './healthchecks/healthchecks.js'
import { MessageProcessingMetricsManager } from './metrics/MessageProcessingMetricsManager.js'

export const SINGLETON_CONFIG = { lifetime: 'SINGLETON' } as const

export type ExternalDependencies = {
  app?: AppInstance
  logger: CommonLogger
  amqpConnection?: Connection
}
export type DependencyOverrides = Partial<DiConfig>
export type Dependencies = CommonDependencies & UsersModuleDependencies
type DiConfig = NameAndRegistrationPair<Dependencies>

declare module '@fastify/awilix' {
  // eslint-disable-next-line @typescript-eslint/no-empty-interface
  interface Cradle extends Dependencies {}

  // eslint-disable-next-line @typescript-eslint/no-empty-interface
  interface RequestCradle extends Dependencies {}
}

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

export class CommonModule extends AbstractModule<CommonDependencies, ExternalDependencies> {
  resolveDependencies(
    diOptions: DependencyInjectionOptions,
    externalDependencies: ExternalDependencies,
  ) {
    return {
      jwt: asSingletonFunction(() => {
        if (!externalDependencies.app) {
          throw new Error('app with JWT set is necessary to use JWT as a dependency')
        }
        return externalDependencies.app.jwt
      }),
      logger: asSingletonFunction(() => externalDependencies.logger),

      scheduler: asSingletonFunction(() => {
        return externalDependencies.app?.scheduler ?? new ToadScheduler()
      }),

      awilixManager: asSingletonFunction(() => {
        if (!externalDependencies.app) {
          throw new Error(
            'app with awilixManager set is necessary to use awilixManager as a dependency',
          )
        }
        return externalDependencies.app?.awilixManager
      }),

      redis: asSingletonFunction(
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
        },
      ),

      redisPublisher: asSingletonFunction(
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
        },
      ),

      redisConsumer: asSingletonFunction(
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
        },
      ),

      drizzle: asSingletonFunction(
        ({ config }: CommonDependencies) => {
          const pg = postgres(config.db.databaseUrl)
          return drizzle(pg)
        },
        {
          dispose: (drizzle) => drizzle.$client.end(),
        },
      ),

      bullmqQueueManager: asSingletonFunction(
        (deps) =>
          new QueueManager(new CommonBullmqFactoryNew(), bullmqSupportedQueues, {
            redisConfig: deps.config.redis,
            isTest: isTest(),
            lazyInitEnabled: !isTest(),
          }),
        {
          asyncInit: (manager) => manager.start(resolveJobQueuesEnabled(diOptions)),
          asyncDispose: 'dispose',
          asyncDisposePriority: 20,
        },
      ),

      amqpConnectionManager: asSingletonFunction(
        () => {
          return new AmqpConnectionManager(getAmqpConfig(), externalDependencies.logger)
        },
        {
          lifetime: Lifetime.SINGLETON,
          asyncInit: 'init',
          asyncDispose: 'close',
          asyncInitPriority: 1,
          asyncDisposePriority: 1,
          enabled: isAnyMessageQueueConsumerEnabled(diOptions),
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
        if (!externalDependencies.app?.newrelicTransactionManager) {
          throw new Error('Observability manager is not set')
        }

        return externalDependencies.app?.newrelicTransactionManager
      }, SINGLETON_CONFIG),
      amplitude: asFunction(() => {
        return externalDependencies.app?.amplitude ?? new FakeAmplitude()
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
          enabled: isJobWorkersEnabled(diOptions.jobWorkersEnabled, HealthcheckRefreshJob.JOB_NAME),
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
          externalDependencies.app?.metrics
            ? new MessageProcessingMetricsManager(externalDependencies.app.metrics)
            : undefined,
        SINGLETON_CONFIG,
      ),
    }
  }

  resolveControllers() {
    return {}
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
