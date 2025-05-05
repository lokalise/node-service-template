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
import { Lifetime, type NameAndRegistrationPair } from 'awilix'
import type { AwilixManager } from 'awilix-manager'
import { drizzle } from 'drizzle-orm/postgres-js'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import { Redis } from 'ioredis'
import {
  AbstractModule,
  type DependencyInjectionOptions,
  asSingletonClass,
  asSingletonFunction,
  isAnyMessageQueueConsumerEnabled,
  isPeriodicJobEnabled,
  resolveJobQueuesEnabled,
} from 'opinionated-machine'
import postgres from 'postgres'
import { ToadScheduler } from 'toad-scheduler'
import type { z } from 'zod'
import type { AppInstance } from '../app.ts'
import { FakeStoreApiClient } from '../integrations/FakeStoreApiClient.ts'
import { type UsersModuleDependencies, userBullmqQueues } from '../modules/users/UserModule.ts'
import { PermissionsMessages } from '../modules/users/consumers/permissionsMessageSchemas.ts'
import { getAmqpConfig, getConfig, isTest } from './config.ts'
import type { Config } from './config.ts'
import { FakeAmplitude } from './fakes/FakeAmplitude.ts'
import {
  DbHealthcheck,
  RedisHealthcheck,
  type SupportedHealthchecks,
} from './healthchecks/healthchecks.ts'
import { MessageProcessingMetricsManager } from './metrics/MessageProcessingMetricsManager.ts'

export type ExternalDependencies = {
  app?: AppInstance
  logger: CommonLogger
  amqpConnection?: Connection
}
export type DependencyOverrides = Partial<DiConfig>
export type Dependencies = CommonDependencies & UsersModuleDependencies
type DiConfig = NameAndRegistrationPair<Dependencies>

declare module '@fastify/awilix' {
  interface Cradle extends Dependencies {}
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

      consumerErrorResolver: asSingletonFunction(() => {
        return new AmqpConsumerErrorResolver()
      }),

      eventRegistry: asSingletonFunction(() => {
        return new EventRegistry(amqpSupportedMessages)
      }),

      publisherManager: asSingletonFunction((dependencies: CommonDependencies) => {
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
      }),

      config: asSingletonFunction(() => {
        return getConfig()
      }),

      // vendor-specific dependencies
      transactionObservabilityManager: asSingletonFunction(() => {
        if (!externalDependencies.app?.newrelicTransactionManager) {
          throw new Error('Observability manager is not set')
        }

        return externalDependencies.app?.newrelicTransactionManager
      }),

      amplitude: asSingletonFunction(() => {
        return externalDependencies.app?.amplitude ?? new FakeAmplitude()
      }),

      errorReporter: asSingletonFunction(() => {
        return {
          report: (report) => reportErrorToBugsnag(report),
        } satisfies ErrorReporter
      }),

      fakeStoreApiClient: asSingletonClass(FakeStoreApiClient),

      healthcheckRefreshJob: asSingletonFunction(
        (dependencies: CommonDependencies) => {
          return new HealthcheckRefreshJob(dependencies, dependencies.healthchecks)
        },
        {
          asyncInit: 'asyncRegister',
          enabled: isPeriodicJobEnabled(
            diOptions.periodicJobsEnabled,
            HealthcheckRefreshJob.JOB_NAME,
          ),
        },
      ),

      dbHealthcheck: asSingletonClass(DbHealthcheck),
      redisHealthcheck: asSingletonClass(RedisHealthcheck),

      healthcheckStore: asSingletonFunction(() => {
        return new HealthcheckResultsStore({
          maxHealthcheckNumber: 10,
        })
      }),

      healthchecks: asSingletonFunction((dependencies: CommonDependencies) => {
        return [dependencies.redisHealthcheck, dependencies.dbHealthcheck]
      }),

      messageProcessingMetricsManager: asSingletonFunction(() =>
        externalDependencies.app?.metrics
          ? new MessageProcessingMetricsManager(externalDependencies.app.metrics)
          : undefined,
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
