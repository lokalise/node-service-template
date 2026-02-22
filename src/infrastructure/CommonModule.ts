import { SNSClient } from '@aws-sdk/client-sns'
import { SQSClient } from '@aws-sdk/client-sqs'
import { STSClient } from '@aws-sdk/client-sts'
import {
  CommonBullmqFactoryNew,
  type ModuleAwareQueueConfiguration,
  ModuleAwareQueueManager,
} from '@lokalise/background-jobs-common'
import { reportErrorToBugsnag } from '@lokalise/fastify-extras'
import {
  type Healthcheck,
  HealthcheckRefreshJob,
  HealthcheckResultsStore,
} from '@lokalise/healthcheck-utils'
import type { CommonLogger, ErrorReporter } from '@lokalise/node-core'
import {
  type AmqpAwareEventDefinition,
  AmqpConnectionManager,
  AmqpConsumerErrorResolver,
  type AmqpTopicPublisherManager,
  type CommonAmqpTopicPublisher,
} from '@message-queue-toolkit/amqp'
import { EventRegistry } from '@message-queue-toolkit/core'
import { SnsConsumerErrorResolver } from '@message-queue-toolkit/sns'
import type { Connection } from 'amqplib'
import { Lifetime, type NameAndRegistrationPair, type Resolver } from 'awilix'
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import { Redis } from 'ioredis'
import {
  AbstractModule,
  asSingletonClass,
  asSingletonFunction,
  type DependencyInjectionOptions,
  type InferModuleDependencies,
  type InferPublicModuleDependencies,
  isAnyMessageQueueConsumerEnabled,
  isPeriodicJobEnabled,
  resolveJobQueuesEnabled,
} from 'opinionated-machine'
import { ToadScheduler } from 'toad-scheduler'
import type { z } from 'zod/v4'
import type { AppInstance } from '../app.ts'
import { FakeStoreApiClient } from '../integrations/FakeStoreApiClient.ts'
import { PermissionsMessages } from '../modules/users/consumers/permissionsMessageSchemas.ts'
import { type UsersModuleDependencies, userBullmqQueues } from '../modules/users/UserModule.ts'
import { type Config, getConfig, nodeEnv, SERVICE_NAME } from './config.ts'
import { FakeAmplitude } from './fakes/FakeAmplitude.ts'
import { DbHealthcheck, RedisHealthcheck } from './healthchecks/healthchecks.ts'
import { MessageProcessingMetricsManager } from './metrics/MessageProcessingMetricsManager.ts'
import { PublisherManagerAdapter } from './PublisherManagerAdapter.ts'

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
export type AmqpSupportedMessages = typeof amqpSupportedMessages

export type MessagesPublishPayloadsType = z.infer<AmqpSupportedMessages[number]['publisherSchema']>

export type PublisherManager = AmqpTopicPublisherManager<
  CommonAmqpTopicPublisher<MessagesPublishPayloadsType>,
  AmqpSupportedMessages
>

const bullmqSupportedQueues = [
  ...userBullmqQueues,
] as const satisfies ModuleAwareQueueConfiguration[]
export type BullmqSupportedQueues = typeof bullmqSupportedQueues

export class CommonModule extends AbstractModule<unknown, ExternalDependencies> {
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
      logger: asSingletonFunction(() => externalDependencies.logger, { public: true }),

      scheduler: asSingletonFunction(
        () => {
          return externalDependencies.app?.scheduler ?? new ToadScheduler()
        },
        { public: true },
      ),

      awilixManager: asSingletonFunction(() => {
        if (!externalDependencies.app) {
          throw new Error(
            'app with awilixManager set is necessary to use awilixManager as a dependency',
          )
        }
        return externalDependencies.app?.awilixManager
      }),

      redis: asSingletonFunction(
        ({ config }: { config: CommonDependencies['config'] }): Redis => {
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
          public: true,
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
        ({ config }: { config: CommonDependencies['config'] }): Redis => {
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
          public: true,
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
        ({ config }: { config: CommonDependencies['config'] }): Redis => {
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
          public: true,
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
        ({
          config,
        }: {
          config: CommonDependencies['config']
        }): PostgresJsDatabase & { $client: { end(): Promise<void> } } => {
          return drizzle(config.db.databaseUrl)
        },
        {
          public: true,
          dispose: (drizzle) => drizzle.$client.end(),
        },
      ),

      bullmqQueueManager: asSingletonFunction(
        ({
          config,
        }: {
          config: CommonDependencies['config']
        }): ModuleAwareQueueManager<BullmqSupportedQueues> =>
          new ModuleAwareQueueManager(
            SERVICE_NAME,
            new CommonBullmqFactoryNew(),
            bullmqSupportedQueues,
            { redisConfig: config.redis, isTest: nodeEnv.isTest },
          ),
        {
          public: true,
          asyncInit: (manager) => manager.start(resolveJobQueuesEnabled(diOptions)),
          asyncDispose: 'dispose',
          asyncDisposePriority: 20,
        },
      ),

      amqpConnectionManager: asSingletonFunction(
        ({ config }: { config: CommonDependencies['config'] }): AmqpConnectionManager => {
          return new AmqpConnectionManager(config.amqp, externalDependencies.logger)
        },
        {
          public: true,
          lifetime: Lifetime.SINGLETON,
          asyncInit: 'init',
          asyncDispose: 'close',
          asyncInitPriority: 1,
          asyncDisposePriority: 1,
          enabled: isAnyMessageQueueConsumerEnabled(diOptions),
        },
      ),

      consumerErrorResolver: asSingletonFunction(
        () => {
          return new AmqpConsumerErrorResolver()
        },
        { public: true },
      ),

      sqsClient: asSingletonFunction(
        ({ config }: { config: Config }) => {
          return new SQSClient({
            region: config.aws.region,
            endpoint: config.aws.endpoint,
            credentials: config.aws.credentials,
          })
        },
        {
          public: true,
          dispose: (client) => {
            client.destroy()
          },
        },
      ),

      snsClient: asSingletonFunction(
        ({ config }: { config: Config }) => {
          return new SNSClient({
            region: config.aws.region,
            endpoint: config.aws.endpoint,
            credentials: config.aws.credentials,
          })
        },
        {
          public: true,
          dispose: (client) => {
            client.destroy()
          },
        },
      ),

      stsClient: asSingletonFunction(
        ({ config }: { config: Config }) => {
          return new STSClient({
            region: config.aws.region,
            endpoint: config.aws.endpoint,
            credentials: config.aws.credentials,
          })
        },
        {
          public: true,
          dispose: (client) => {
            client.destroy()
          },
        },
      ),

      snsConsumerErrorResolver: asSingletonFunction(
        () => {
          return new SnsConsumerErrorResolver()
        },
        { public: true },
      ),

      eventRegistry: asSingletonFunction(
        () => {
          return new EventRegistry(amqpSupportedMessages)
        },
        { public: true },
      ),

      publisherManager: asSingletonClass(PublisherManagerAdapter, { public: true }),

      config: asSingletonFunction(() => getConfig(), { public: true }),

      // vendor-specific dependencies
      transactionObservabilityManager: asSingletonFunction(
        () => {
          if (!externalDependencies.app?.openTelemetryTransactionManager) {
            throw new Error('Observability manager is not set')
          }

          return externalDependencies.app?.openTelemetryTransactionManager
        },
        { public: true },
      ),

      amplitude: asSingletonFunction(
        () => {
          return externalDependencies.app?.amplitude ?? new FakeAmplitude()
        },
        { public: true },
      ),

      errorReporter: asSingletonFunction(
        () => {
          return {
            report: (report) => reportErrorToBugsnag(report),
          } satisfies ErrorReporter
        },
        { public: true },
      ),

      fakeStoreApiClient: asSingletonClass(FakeStoreApiClient, { public: true }),

      healthcheckRefreshJob: asSingletonClass(HealthcheckRefreshJobAdapter, {
        asyncInit: 'asyncRegister',
        asyncDispose: 'dispose',
        enabled: isPeriodicJobEnabled(
          diOptions.periodicJobsEnabled,
          HealthcheckRefreshJob.JOB_NAME,
        ),
      }),

      dbHealthcheck: asSingletonClass(DbHealthcheck),
      redisHealthcheck: asSingletonClass(RedisHealthcheck),

      healthcheckStore: asSingletonFunction(() => {
        return new HealthcheckResultsStore({
          maxHealthcheckNumber: 10,
        })
      }),

      healthchecks: asSingletonFunction(
        ({
          redisHealthcheck,
          dbHealthcheck,
        }: {
          redisHealthcheck: CommonDependencies['redisHealthcheck']
          dbHealthcheck: CommonDependencies['dbHealthcheck']
        }): Healthcheck[] => {
          return [redisHealthcheck, dbHealthcheck]
        },
      ),

      messageProcessingMetricsManager: asSingletonFunction(
        () =>
          externalDependencies.app?.metrics
            ? new MessageProcessingMetricsManager(externalDependencies.app.metrics)
            : undefined,
        { public: true },
      ),
    } satisfies Record<string, Resolver<unknown>>
  }

  override resolveControllers() {
    return {}
  }
}

export type CommonDependencies = InferModuleDependencies<CommonModule>

declare module 'opinionated-machine' {
  interface PublicDependencies extends InferPublicModuleDependencies<CommonModule> {}
}

class HealthcheckRefreshJobAdapter extends HealthcheckRefreshJob {
  constructor(deps: CommonDependencies) {
    super(deps, deps.healthchecks)
  }
}
