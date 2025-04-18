import {
  executeAndHandleGlobalErrors,
  globalLogger,
  resolveGlobalErrorLogObject,
} from '@lokalise/node-core'

import { ENABLE_ALL } from 'opinionated-machine'
import { getApp } from './app.ts'
import { getConfig } from './infrastructure/config.ts'

async function start() {
  globalLogger.info('Starting application...')
  const config = executeAndHandleGlobalErrors(getConfig)
  const app = await getApp({
    monitoringEnabled: config.app.metrics.isEnabled,
    jobQueuesEnabled: ENABLE_ALL,
    enqueuedJobWorkersEnabled: ENABLE_ALL,
    messageQueueConsumersEnabled: ENABLE_ALL,
    periodicJobsEnabled: ENABLE_ALL,
  })

  try {
    await app.listen({
      host: config.app.bindAddress,
      port: config.app.port,
      listenTextResolver: (address) => {
        return `node-service-template app listening at ${address}`
      },
    })
  } catch (err) {
    app.log.error(resolveGlobalErrorLogObject(err))
    process.exit(1)
  }
}

void start()
