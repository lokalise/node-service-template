import {
  executeAndHandleGlobalErrors,
  globalLogger,
  resolveGlobalErrorLogObject,
} from '@lokalise/node-core'
import { startProfiling } from '@lokalise/pyroscope-profiling'
import { ENABLE_ALL } from 'opinionated-machine'
import { getApp } from './app.ts'
import { getConfig, getProfilingConfig } from './infrastructure/config.ts'

export async function startServer() {
  globalLogger.info('Starting application...')
  const config = executeAndHandleGlobalErrors(getConfig)

  // Before the app is built, so the first profile window covers startup and the DI wiring
  // too. A plugin cannot run earlier than the app it is registered on, which is why the one
  // in app.ts is registered with `start: false`. A no-op unless PYROSCOPE_ENABLED is true.
  await startProfiling(
    getProfilingConfig(),
    {
      appEnv: config.app.appEnv,
      appVersion: config.app.appVersion,
      gitCommitSha: config.app.gitCommitSha,
    },
    globalLogger,
  )

  const app = await getApp({
    monitoringEnabled: config.app.metrics.isEnabled,
    healthchecksEnabled: true,
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
