import type { JWT } from '@fastify/jwt'
import type { NewRelicTransactionManager } from '@lokalise/fastify-extras'
import { reportErrorToBugsnag } from '@lokalise/fastify-extras'
import type { ErrorReporter, ErrorResolver } from '@lokalise/node-core'
import { globalLogger, InternalError } from '@lokalise/node-core'
import { PrismaClient } from '@prisma/client'
import type { Connection } from 'amqplib'
import type { AwilixContainer, Resolver } from 'awilix'
import { asClass, asFunction, Lifetime } from 'awilix'
import type { FastifyInstance, FastifyBaseLogger } from 'fastify'
import Redis from 'ioredis'
import type P from 'pino'
import { pino } from 'pino'

import { FakeStoreApiClient } from '../integrations/FakeStoreApiClient'
import { PermissionConsumer } from '../modules/users/consumers/PermissionConsumer'
import { DeleteOldUsersJob } from '../modules/users/jobs/DeleteOldUsersJob'
import { ProcessLogFilesJob } from '../modules/users/jobs/ProcessLogFilesJob'
import { SendEmailsJob } from '../modules/users/jobs/SendEmailsJob'
import { PermissionPublisher } from '../modules/users/publishers/PermissionPublisher'
import { ConfigStore } from '../modules/users/repositories/ConfigStore'
import { UrlCache } from '../modules/users/repositories/UrlCache'
import { UserCache } from '../modules/users/repositories/UserCache'
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

export function registerDependencies(
  diContainer: AwilixContainer,
  dependencies: ExternalDependencies = { logger: globalLogger },
  dependencyOverrides: DependencyOverrides = {},
): void {
  const isAmqpEnabled = dependencies.amqpConnection !== undefined

  const diConfig: DiConfig = {
    jwt: asFunction(() => {
      return dependencies.app?.jwt
    }, SINGLETON_CONFIG),
    logger: asFunction(() => dependencies.logger ?? pino(), SINGLETON_CONFIG),

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
    userCache: asClass(UserCache, SINGLETON_CONFIG),
    urlCache: asClass(UrlCache, SINGLETON_CONFIG),
    configStore: asClass(ConfigStore, SINGLETON_CONFIG),

    permissionsService: asClass(PermissionsService, SINGLETON_CONFIG),
    permissionConsumer: asClass(PermissionConsumer, {
      lifetime: Lifetime.SINGLETON,
      asyncInit: isAmqpEnabled ? 'consume' : false,
      asyncDispose: isAmqpEnabled ? 'close' : false,
      asyncDisposePriority: 10,
    }),
    permissionPublisher: asClass(PermissionPublisher, {
      lifetime: Lifetime.SINGLETON,
      asyncInit: isAmqpEnabled ? 'init' : false,
      asyncDispose: isAmqpEnabled ? 'close' : false,
      asyncDisposePriority: 20,
    }),

    processLogFilesJob: asClass(ProcessLogFilesJob, SINGLETON_CONFIG),
    deleteOldUsersJob: asClass(DeleteOldUsersJob, SINGLETON_CONFIG),
    sendEmailsJob: asClass(SendEmailsJob, SINGLETON_CONFIG),

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

  redis: Redis
  prisma: PrismaClient

  amqpConnection: Connection

  deleteOldUsersJob: DeleteOldUsersJob
  processLogFilesJob: ProcessLogFilesJob
  sendEmailsJob: SendEmailsJob

  userRepository: UserRepository
  userService: UserService
  userCache: UserCache
  urlCache: UrlCache
  configStore: ConfigStore

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
