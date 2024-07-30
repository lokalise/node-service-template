import type { User } from '@prisma/client'
import type { Resolver } from 'awilix'
import { Lifetime, asClass, asFunction } from 'awilix'
import type { InMemoryCacheConfiguration, LoaderConfig } from 'layered-loader'
import { Loader, RedisCache, createNotificationPair } from 'layered-loader'

import type { CommonDependencies } from '../../infrastructure/commonDiConfig.js'
import type { DIOptions } from '../../infrastructure/diConfigUtils.js'
import { isJobEnabled, isQueueEnabled } from '../../infrastructure/diConfigUtils.js'
import { SINGLETON_CONFIG } from '../../infrastructure/parentDiConfig.js'

import { PermissionConsumer } from './consumers/PermissionConsumer.js'
import { UserDataSource } from './datasources/UserDataSource.js'
import { UserImportJob } from './job-queue-processors/UserImportJob.js'
import { DeleteOldUsersJob } from './periodic-jobs/DeleteOldUsersJob.js'
import { ProcessLogFilesJob } from './periodic-jobs/ProcessLogFilesJob.js'
import { SendEmailsJob } from './periodic-jobs/SendEmailsJob.js'
import { UserRepository } from './repositories/UserRepository.js'
import { PermissionsService } from './services/PermissionsService.js'
import { UserService } from './services/UserService.js'

const IN_MEMORY_CACHE_TTL = 1000 * 60 * 5
const IN_MEMORY_TTL_BEFORE_REFRESH = 1000 * 25

const IN_MEMORY_CONFIGURATION_BASE: InMemoryCacheConfiguration = {
  ttlInMsecs: IN_MEMORY_CACHE_TTL,
  ttlLeftBeforeRefreshInMsecs: IN_MEMORY_TTL_BEFORE_REFRESH,
  cacheType: 'fifo-object',
}

// biome-ignore lint/suspicious/noExplicitAny: it's ok
type UsersDiConfig = Record<keyof UsersModuleDependencies, Resolver<any>>

export type UsersModuleDependencies = {
  userRepository: UserRepository
  userService: UserService
  userLoader: Loader<User>

  permissionsService: PermissionsService
  permissionConsumer: PermissionConsumer

  deleteOldUsersJob: DeleteOldUsersJob
  processLogFilesJob: ProcessLogFilesJob
  sendEmailsJob: SendEmailsJob

  userImportJob: UserImportJob
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
      (deps: UsersInjectableDependencies) => {
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
      enabled: isQueueEnabled(options, PermissionConsumer.QUEUE_NAME),
    }),

    processLogFilesJob: asClass(ProcessLogFilesJob, {
      lifetime: Lifetime.SINGLETON,
      eagerInject: 'register',
      enabled: isJobEnabled(options, ProcessLogFilesJob.JOB_NAME),
    }),
    deleteOldUsersJob: asClass(DeleteOldUsersJob, {
      lifetime: Lifetime.SINGLETON,
      eagerInject: 'register',
      enabled: isJobEnabled(options, DeleteOldUsersJob.JOB_NAME),
    }),
    sendEmailsJob: asClass(SendEmailsJob, {
      lifetime: Lifetime.SINGLETON,
      eagerInject: 'register',
      enabled: isJobEnabled(options, SendEmailsJob.JOB_NAME),
    }),

    userImportJob: asClass(UserImportJob, {
      lifetime: Lifetime.SINGLETON,
      asyncInit: 'start',
      asyncDispose: 'dispose',
      enabled: isJobEnabled(options, UserImportJob.QUEUE_ID),
    }),
  }
}
