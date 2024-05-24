import type { PinoLoggerOptions } from 'fastify/types/logger'
import { levels } from 'pino'

import type { AppConfig } from './config.js'
import { isProduction } from './config.js'

export function resolveLoggerConfiguration(appConfig: AppConfig): PinoLoggerOptions | boolean {
  const config: PinoLoggerOptions = {
    level: appConfig.logLevel,
    formatters: {
      level: (_label, numericLevel): { level: string } => {
        const level = levels.labels[numericLevel] || 'unknown'
        return { level }
      },
    },
  }
  if (!isProduction()) {
    config.transport = {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'hostname,pid',
      },
    }
  }
  return config
}
