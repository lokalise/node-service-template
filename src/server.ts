/* istanbul ignore file */

import {
  executeAndHandleGlobalErrors,
  globalLogger,
  resolveGlobalErrorLogObject,
} from '@lokalise/node-core'

if (process.env.NEW_RELIC_ENABLED !== 'false') {
  // NewRelic performs magic by importing environment variables automatically
  // https://docs.newrelic.com/docs/apm/agents/nodejs-agent/installation-configuration/nodejs-agent-configuration/#environment
  await import('newrelic')
}

import packageJson from '../package.json' with { type: 'json' }

import { getApp } from './app.js'
import type { Config } from './infrastructure/config.js'
import { getConfig } from './infrastructure/config.js'

async function start() {
  globalLogger.info('Starting application...')
  const config = executeAndHandleGlobalErrors<Config>(getConfig)
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
        return `${packageJson.name} listening at ${address}`
      },
    })
  } catch (err) {
    app.log.error(resolveGlobalErrorLogObject(err))
    process.exit(1)
  }
}

void start()
