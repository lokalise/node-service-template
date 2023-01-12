import type { FastifyInstance } from 'fastify'
import { CronJob, SimpleIntervalJob } from 'toad-scheduler'

import { createTask } from '../infrastructure/jobs/jobUtils'

export function registerJobs(app: FastifyInstance) {
  const { processLogFilesJob, deleteOldUsersJob, sendEmailsJob, config } = app.diContainer.cradle
  const processLogFilesJobTask = createTask(app, processLogFilesJob)
  app.scheduler.addSimpleIntervalJob(
    new SimpleIntervalJob(
      { seconds: config.jobs.processLogFilesJob.periodInSeconds },
      processLogFilesJobTask,
      { id: 'processLogFilesJob', preventOverrun: true },
    ),
  )

  const deleteOldUsersJobTask = createTask(app, deleteOldUsersJob)
  app.scheduler.addSimpleIntervalJob(
    new SimpleIntervalJob(
      { seconds: config.jobs.deleteOldUsersJob.periodInSeconds },
      deleteOldUsersJobTask,
      { id: 'deleteOldUsersJob', preventOverrun: true },
    ),
  )

  const sendEmailsJobTask = createTask(app, sendEmailsJob)
  app.scheduler.addCronJob(
    new CronJob({ cronExpression: config.jobs.sendEmailsJob.cronExpression }, sendEmailsJobTask, {
      id: 'sendEmailsJob',
      preventOverrun: true,
    }),
  )
}
