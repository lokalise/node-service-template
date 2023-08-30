import type { User } from '@prisma/client'
import type { Resolver } from 'awilix'
import { asClass, asFunction, Lifetime } from 'awilix'
import type { InMemoryCacheConfiguration, LoaderConfig } from 'layered-loader'
import { Loader, createNotificationPair, RedisCache } from 'layered-loader'

import type { CommonDependencies } from '../../infrastructure/commonDiConfig'
import type { Dependencies, DIOptions } from '../../infrastructure/diConfig'
import { SINGLETON_CONFIG } from '../../infrastructure/diConfig'

import { PermissionConsumer } from './consumers/PermissionConsumer'
import { UserDataSource } from './datasources/UserDataSource'
import { DeleteOldUsersJob } from './jobs/DeleteOldUsersJob'
import { ProcessLogFilesJob } from './jobs/ProcessLogFilesJob'
import { SendEmailsJob } from './jobs/SendEmailsJob'
import { PermissionPublisher } from './publishers/PermissionPublisher'
import { UserRepository } from './repositories/UserRepository'
import { PermissionsService } from './services/PermissionsService'
import { UserService } from './services/UserService'

const IN_MEMORY_CACHE_TTL = 1000 * 60 * 5
const IN_MEMORY_TTL_BEFORE_REFRESH = 1000 * 25

const IN_MEMORY_CONFIGURATION_BASE: InMemoryCacheConfiguration = {
  ttlInMsecs: IN_MEMORY_CACHE_TTL,
  ttlLeftBeforeRefreshInMsecs: IN_MEMORY_TTL_BEFORE_REFRESH,
  cacheType: 'fifo-object',
}

type UsersDiConfig = Record<keyof UsersModuleDependencies, Resolver<unknown>>

export type UsersModuleDependencies = {
  userRepository: UserRepository
  userService: UserService
  userLoader: Loader<User>

  permissionsService: PermissionsService
  permissionConsumer: PermissionConsumer
  permissionPublisher: PermissionPublisher

  deleteOldUsersJob: DeleteOldUsersJob
  processLogFilesJob: ProcessLogFilesJob
  sendEmailsJob: SendEmailsJob
}

export type UsersInjectableDependencies = UsersModuleDependencies & CommonDependencies

export type UsersPublicDependencies = Pick<
  UsersInjectableDependencies,
  'userService' | 'permissionsService'
>

export function resolveUsersConfig(options: DIOptions): UsersDiConfig {
  return {
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
          dataSources: [new UserDataSource(deps)],
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
      asyncInit: 'start',
      asyncInitPriority: 10,
      asyncDispose: 'close',
      asyncDisposePriority: 10,
      enabled: options.amqpEnabled,
    }),
    permissionPublisher: asClass(PermissionPublisher, {
      lifetime: Lifetime.SINGLETON,
      asyncInit: 'init',
      asyncInitPriority: 20,
      asyncDispose: 'close',
      asyncDisposePriority: 20,
      enabled: options.amqpEnabled,
    }),

    processLogFilesJob: asClass(ProcessLogFilesJob, {
      lifetime: Lifetime.SINGLETON,
      eagerInject: 'register',
      enabled: options.jobsEnabled,
    }),
    deleteOldUsersJob: asClass(DeleteOldUsersJob, {
      lifetime: Lifetime.SINGLETON,
      eagerInject: 'register',
      enabled: options.jobsEnabled,
    }),
    sendEmailsJob: asClass(SendEmailsJob, {
      lifetime: Lifetime.SINGLETON,
      eagerInject: 'register',
      enabled: options.jobsEnabled,
    }),
  }
}
