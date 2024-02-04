import type { FastifyBaseLogger } from 'fastify'
import { stdSerializers } from 'pino'
import { AsyncTask } from 'toad-scheduler'

import type { AbstractBackgroundJob } from '../AbstractBackgroundJob.js'

export function createTask(logger: FastifyBaseLogger, job: AbstractBackgroundJob) {
  return new AsyncTask(
    job.jobId,
    () => {
      return job.process()
    },
    (error) => {
      logger.error(
        stdSerializers.err({
          name: error.name,
          message: error.message,
          stack: error.stack,
        }),
      )
    },
  )
}
