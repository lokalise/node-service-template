import {
  executeAndHandleGlobalErrors,
  globalLogger,
  resolveGlobalErrorLogObject,
} from '@lokalise/node-core'

import { getApp } from './app.js'
import { getConfig } from './infrastructure/config.js'

async function start() {
  globalLogger.info('Starting application...')
  const config = executeAndHandleGlobalErrors(getConfig)
  const app = await getApp({
    monitoringEnabled: config.app.metrics.isEnabled,
    enqueuedJobQueuesEnabled: true,
    enqueuedJobsEnabled: true,
    amqpConsumersEnabled: true,
    arePeriodicJobsEnabled: true,
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
