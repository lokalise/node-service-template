import type { FastifyInstance } from 'fastify'
import { stdSerializers } from 'pino'
import { AsyncTask } from 'toad-scheduler'

import type { AbstractBackgroundJob } from '../AbstractBackgroundJob'

export function createTask(app: FastifyInstance, job: AbstractBackgroundJob) {
  return new AsyncTask(
    job.jobId,
    () => {
      return job.process()
    },
    (error) => {
      app.log.error(
        stdSerializers.err({
          name: error.name,
          message: error.message,
          stack: error.stack,
        }),
      )
    },
  )
}
