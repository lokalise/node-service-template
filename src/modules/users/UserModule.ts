import type { QueueConfiguration } from '@lokalise/background-jobs-common'
import {
  type InMemoryCacheConfiguration,
  Loader,
  type LoaderConfig,
  RedisCache,
  createNotificationPair,
} from 'layered-loader'
import {
  AbstractModule,
  type DependencyInjectionOptions,
  type MandatoryNameAndRegistrationPair,
  asControllerClass,
  asEnqueuedJobWorkerClass,
  asMessageQueueHandlerClass,
  asPeriodicJobClass,
  asRepositoryClass,
  asServiceClass,
  asSingletonFunction,
} from 'opinionated-machine'
import type { User } from '../../db/schema/user.ts'
import type { CommonDependencies } from '../../infrastructure/CommonModule.ts'
import { PermissionConsumer } from './consumers/PermissionConsumer.ts'
import { UserController } from './controllers/UserController.ts'
import { UserDataSource } from './datasources/UserDataSource.ts'
import { USER_IMPORT_JOB_PAYLOAD, UserImportJob } from './job-queue-processors/UserImportJob.ts'
import { DeleteOldUsersJob } from './periodic-jobs/DeleteOldUsersJob.ts'
import { ProcessLogFilesJob } from './periodic-jobs/ProcessLogFilesJob.ts'
import { SendEmailsJob } from './periodic-jobs/SendEmailsJob.ts'
import { UserRepository } from './repositories/UserRepository.ts'
import { PermissionsService } from './services/PermissionsService.ts'
import { UserService } from './services/UserService.ts'

const IN_MEMORY_CACHE_TTL = 1000 * 60 * 5
const IN_MEMORY_TTL_BEFORE_REFRESH = 1000 * 25

const IN_MEMORY_CONFIGURATION_BASE: InMemoryCacheConfiguration = {
  ttlInMsecs: IN_MEMORY_CACHE_TTL,
  ttlLeftBeforeRefreshInMsecs: IN_MEMORY_TTL_BEFORE_REFRESH,
  cacheType: 'fifo-object',
}

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

export const userBullmqQueues = [
  {
    queueId: UserImportJob.QUEUE_ID,
    jobPayloadSchema: USER_IMPORT_JOB_PAYLOAD,
  },
] as const satisfies QueueConfiguration[]

export class UserModule extends AbstractModule<UsersModuleDependencies> {
  resolveDependencies(
    diOptions: DependencyInjectionOptions,
  ): MandatoryNameAndRegistrationPair<UsersModuleDependencies> {
    return {
      userRepository: asRepositoryClass(UserRepository),
      userService: asServiceClass(UserService),

      userLoader: asSingletonFunction((deps: UsersInjectableDependencies) => {
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
      }),

      permissionsService: asServiceClass(PermissionsService),
      permissionConsumer: asMessageQueueHandlerClass(PermissionConsumer, {
        diOptions,
        queueName: PermissionConsumer.QUEUE_NAME,
      }),

      processLogFilesJob: asPeriodicJobClass(ProcessLogFilesJob, {
        diOptions,
        jobName: ProcessLogFilesJob.JOB_NAME,
      }),

      deleteOldUsersJob: asPeriodicJobClass(DeleteOldUsersJob, {
        diOptions,
        jobName: DeleteOldUsersJob.JOB_NAME,
      }),

      sendEmailsJob: asPeriodicJobClass(SendEmailsJob, {
        diOptions,
        jobName: SendEmailsJob.JOB_NAME,
      }),

      userImportJob: asEnqueuedJobWorkerClass(UserImportJob, {
        diOptions,
        queueName: UserImportJob.QUEUE_ID,
      }),
    }
  }

  resolveControllers(): MandatoryNameAndRegistrationPair<unknown> {
    return {
      userController: asControllerClass(UserController),
    }
  }
}
