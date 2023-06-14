import type { JWT } from '@fastify/jwt'
import type { NewRelicTransactionManager } from '@lokalise/fastify-extras'
import { reportErrorToBugsnag } from '@lokalise/fastify-extras'
import type { ErrorReporter, ErrorResolver } from '@lokalise/node-core'
import { globalLogger, InternalError } from '@lokalise/node-core'
import type { User } from '@prisma/client'
import { PrismaClient } from '@prisma/client'
import type { Connection } from 'amqplib'
import type { AwilixContainer, Resolver } from 'awilix'
import { asClass, asFunction, Lifetime } from 'awilix'
import type { FastifyInstance, FastifyBaseLogger } from 'fastify'
import Redis from 'ioredis'
import type { InMemoryCacheConfiguration, LoaderConfig } from 'layered-loader'
import { createNotificationPair, Loader, RedisCache } from 'layered-loader'
import type P from 'pino'
import { pino } from 'pino'
import { ToadScheduler } from 'toad-scheduler'

import { FakeStoreApiClient } from '../integrations/FakeStoreApiClient'
import { PermissionConsumer } from '../modules/users/consumers/PermissionConsumer'
import { DeleteOldUsersJob } from '../modules/users/jobs/DeleteOldUsersJob'
import { ProcessLogFilesJob } from '../modules/users/jobs/ProcessLogFilesJob'
import { SendEmailsJob } from '../modules/users/jobs/SendEmailsJob'
import { UserLoader } from '../modules/users/loaders/UserLoader'
import { PermissionPublisher } from '../modules/users/publishers/PermissionPublisher'
import { UserRepository } from '../modules/users/repositories/UserRepository'
import { PermissionsService } from '../modules/users/services/PermissionsService'
import { UserService } from '../modules/users/services/UserService'

import { ConsumerErrorResolver } from './amqp/ConsumerErrorResolver'
import type { Config } from './config'
import { getConfig } from './config'

export type ExternalDependencies = {
  app?: FastifyInstance
  logger: P.Logger
  amqpConnection?: Connection
}
export const SINGLETON_CONFIG = { lifetime: Lifetime.SINGLETON }

export type DependencyOverrides = Partial<DiConfig>

export type DIOptions = {
  jobsEnabled?: boolean
  amqpEnabled?: boolean
}

const IN_MEMORY_CACHE_TTL = 1000 * 60 * 5
const IN_MEMORY_TTL_BEFORE_REFRESH = 1000 * 25

const IN_MEMORY_CONFIGURATION_BASE: InMemoryCacheConfiguration = {
  ttlInMsecs: IN_MEMORY_CACHE_TTL,
  ttlLeftBeforeRefreshInMsecs: IN_MEMORY_TTL_BEFORE_REFRESH,
  cacheType: 'fifo-object',
}

export function registerDependencies(
  diContainer: AwilixContainer,
  dependencies: ExternalDependencies = { logger: globalLogger },
  dependencyOverrides: DependencyOverrides = {},
  options: DIOptions = {},
): void {
  const isAmqpEnabled = dependencies.amqpConnection !== undefined
  const areJobsEnabled = options.jobsEnabled

  const diConfig: DiConfig = {
    jwt: asFunction(() => {
      return dependencies.app?.jwt
    }, SINGLETON_CONFIG),
    logger: asFunction(() => dependencies.logger ?? pino(), SINGLETON_CONFIG),

    scheduler: asFunction(() => {
      return dependencies.app?.scheduler ?? new ToadScheduler()
    }, SINGLETON_CONFIG),

    redis: asFunction(
      ({ config }: Dependencies) => {
        const redisConfig = config.redis

        return new Redis({
          host: redisConfig.host,
          db: redisConfig.db,
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
            void redis.quit((err, result) => {
              if (err) {
                globalLogger.error(`Error while closing redis: ${err.message}`)
                return resolve(err)
              }
              return resolve(result)
            })
          })
        },
        lifetime: Lifetime.SINGLETON,
      },
    ),

    redisPublisher: asFunction(
      ({ config }: Dependencies) => {
        const redisConfig = config.redis

        return new Redis({
          host: redisConfig.host,
          db: redisConfig.db,
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
            void redis.quit((err, result) => {
              if (err) {
                globalLogger.error(`Error while closing redis: ${err.message}`)
                return resolve(err)
              }
              return resolve(result)
            })
          })
        },
        lifetime: Lifetime.SINGLETON,
      },
    ),

    redisConsumer: asFunction(
      ({ config }: Dependencies) => {
        const redisConfig = config.redis

        return new Redis({
          host: redisConfig.host,
          db: redisConfig.db,
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
            void redis.quit((err, result) => {
              if (err) {
                globalLogger.error(`Error while closing redis: ${err.message}`)
                return resolve(err)
              }
              return resolve(result)
            })
          })
        },
        lifetime: Lifetime.SINGLETON,
      },
    ),

    prisma: asFunction(
      ({ config }: Dependencies) => {
        return new PrismaClient({
          datasources: {
            db: {
              url: config.db.databaseUrl,
            },
          },
        })
      },
      {
        dispose: (prisma) => {
          return prisma.$disconnect()
        },
        lifetime: Lifetime.SINGLETON,
      },
    ),

    amqpConnection: asFunction(
      () => {
        if (!dependencies.amqpConnection) {
          throw new InternalError({
            message: 'amqp connection is a mandatory dependency',
            errorCode: 'MISSING_DEPENDENCY',
          })
        }
        return dependencies.amqpConnection
      },
      {
        lifetime: Lifetime.SINGLETON,
        dispose: (connection) => {
          return connection.close()
        },
      },
    ),
    consumerErrorResolver: asFunction(() => {
      return new ConsumerErrorResolver()
    }),

    config: asFunction(() => {
      return getConfig()
    }, SINGLETON_CONFIG),

    userRepository: asClass(UserRepository, SINGLETON_CONFIG),
    userService: asClass(UserService, SINGLETON_CONFIG),

    userLoader: asFunction(
      (deps: Dependencies) => {
        const { publisher: notificationPublisher, consumer: notificationConsumer } =
          createNotificationPair<User>({
            channel: 'user-cache-notifications',
            consumerRedis: deps.redisConsumer,
            publisherRedis: deps.redisPublisher,
          })

        const config: LoaderConfig<User> = {
          inMemoryCache: {
            ...IN_MEMORY_CONFIGURATION_BASE,
            maxItems: 1000,
          },
          asyncCache: new RedisCache<User>(deps.redis, {
            json: true,
            prefix: 'layered-loader:users:',
            ttlInMsecs: 1000 * 60 * 60,
          }),
          dataSources: [new UserLoader(deps)],
          notificationConsumer,
          notificationPublisher,
          logger: deps.logger,
        }
        return new Loader(config)
      },
      {
        lifetime: Lifetime.SINGLETON,
      },
    ),

    permissionsService: asClass(PermissionsService, SINGLETON_CONFIG),
    permissionConsumer: asClass(PermissionConsumer, {
      lifetime: Lifetime.SINGLETON,
      asyncInit: 'consume',
      asyncDispose: 'close',
      asyncDisposePriority: 10,
      enabled: isAmqpEnabled,
    }),
    permissionPublisher: asClass(PermissionPublisher, {
      lifetime: Lifetime.SINGLETON,
      asyncInit: 'init',
      asyncDispose: 'close',
      asyncDisposePriority: 20,
      enabled: isAmqpEnabled,
    }),

    processLogFilesJob: asClass(ProcessLogFilesJob, {
      lifetime: Lifetime.SINGLETON,
      eagerInject: 'register',
      enabled: areJobsEnabled,
    }),
    deleteOldUsersJob: asClass(DeleteOldUsersJob, {
      lifetime: Lifetime.SINGLETON,
      eagerInject: 'register',
      enabled: areJobsEnabled,
    }),
    sendEmailsJob: asClass(SendEmailsJob, {
      lifetime: Lifetime.SINGLETON,
      eagerInject: 'register',
      enabled: areJobsEnabled,
    }),

    // vendor-specific dependencies
    newRelicBackgroundTransactionManager: asFunction(() => {
      return dependencies.app?.newrelicTransactionManager
    }, SINGLETON_CONFIG),
    errorReporter: asFunction(() => {
      return {
        report: (report) => reportErrorToBugsnag(report),
      } satisfies ErrorReporter
    }),

    fakeStoreApiClient: asClass(FakeStoreApiClient, SINGLETON_CONFIG),
  }
  diContainer.register(diConfig)

  for (const [dependencyKey, dependencyValue] of Object.entries(dependencyOverrides)) {
    diContainer.register(dependencyKey, dependencyValue)
  }
}

type DiConfig = Record<keyof Dependencies, Resolver<unknown>>

export interface Dependencies {
  jwt: JWT
  config: Config
  logger: FastifyBaseLogger & P.Logger
  scheduler: ToadScheduler

  redis: Redis
  redisPublisher: Redis
  redisConsumer: Redis
  prisma: PrismaClient

  amqpConnection: Connection

  deleteOldUsersJob: DeleteOldUsersJob
  processLogFilesJob: ProcessLogFilesJob
  sendEmailsJob: SendEmailsJob

  userRepository: UserRepository
  userService: UserService
  userLoader: Loader<User>

  permissionsService: PermissionsService

  // vendor-specific dependencies
  newRelicBackgroundTransactionManager: NewRelicTransactionManager

  errorReporter: ErrorReporter
  consumerErrorResolver: ErrorResolver
  permissionConsumer: PermissionConsumer
  permissionPublisher: PermissionPublisher

  fakeStoreApiClient: FakeStoreApiClient
}

declare module '@fastify/awilix' {
  // eslint-disable-next-line @typescript-eslint/no-empty-interface
  interface Cradle extends Dependencies {}

  // eslint-disable-next-line @typescript-eslint/no-empty-interface
  interface RequestCradle extends Dependencies {}
}
