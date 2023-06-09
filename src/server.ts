/* istanbul ignore file */

import {
  executeAndHandleGlobalErrors,
  globalLogger,
  resolveGlobalErrorLogObject,
} from '@lokalise/node-core'

if (process.env.NEW_RELIC_ENABLED !== 'false') {
  require('newrelic')
}

import { name } from '../package.json'

import { getApp } from './app'
import type { Config } from './infrastructure/config'
import { getConfig } from './infrastructure/config'

async function start() {
  globalLogger.info('Starting application...')
  const config = executeAndHandleGlobalErrors<Config>(getConfig)
  const app = await getApp({
    monitoringEnabled: config.app.metrics.isEnabled,
    amqpEnabled: true,
  })

  try {
    await app.listen({
      host: config.app.bindAddress,
      port: config.app.port,
      listenTextResolver: (address) => {
        return `${name} listening at ${address}`
      },
    })
  } catch (err) {
    app.log.error(resolveGlobalErrorLogObject(err))
    process.exit(1)
  }
}

void start()
