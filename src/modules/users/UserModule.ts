import type { ModuleAwareQueueConfiguration } from '@lokalise/background-jobs-common'
import type { Loader } from 'layered-loader'
import {
  AbstractModule,
  asControllerClass,
  asEnqueuedJobWorkerClass,
  asMessageQueueHandlerClass,
  asPeriodicJobClass,
  asRepositoryClass,
  asServiceClass,
  asSingletonClass,
  type DependencyInjectionOptions,
  type InferPublicModuleDependencies,
  type MandatoryNameAndRegistrationPair,
  type PublicDependencies,
} from 'opinionated-machine'
import type { User } from '../../db/schema/user.ts'
import { PermissionConsumer } from './consumers/PermissionConsumer.ts'
import { UserController } from './controllers/UserController.ts'
import { USER_IMPORT_JOB_PAYLOAD, UserImportJob } from './job-queue-processors/UserImportJob.ts'
import { DeleteOldUsersJob } from './periodic-jobs/DeleteOldUsersJob.ts'
import { ProcessLogFilesJob } from './periodic-jobs/ProcessLogFilesJob.ts'
import { SendEmailsJob } from './periodic-jobs/SendEmailsJob.ts'
import { UserRepository } from './repositories/UserRepository.ts'
import { PermissionsService } from './services/PermissionsService.ts'
import { UserService } from './services/UserService.ts'
import { UserLoader } from './UserLoader.ts'

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

export type UsersInjectableDependencies = UsersModuleDependencies & PublicDependencies

export const userBullmqQueues = [
  {
    queueId: UserImportJob.QUEUE_ID,
    moduleId: 'user',
    jobPayloadSchema: USER_IMPORT_JOB_PAYLOAD,
  },
] as const satisfies ModuleAwareQueueConfiguration[]

export class UserModule extends AbstractModule<UsersModuleDependencies> {
  resolveDependencies(
    diOptions: DependencyInjectionOptions,
  ): MandatoryNameAndRegistrationPair<UsersModuleDependencies> {
    return {
      userRepository: asRepositoryClass(UserRepository),
      userService: asServiceClass(UserService),

      userLoader: asSingletonClass(UserLoader),

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

  override resolveControllers(): MandatoryNameAndRegistrationPair<unknown> {
    return {
      userController: asControllerClass(UserController),
    }
  }
}

declare module 'opinionated-machine' {
  interface PublicDependencies extends InferPublicModuleDependencies<UserModule> {}
}
