import type { LoggerOptions } from 'pino'
import { levels } from 'pino'

import type { AppConfig } from './config.js'
import { isProduction } from './config.js'

export function resolveLoggerConfiguration(appConfig: AppConfig): LoggerOptions | boolean {
  const config: LoggerOptions = {
    level: appConfig.logLevel,
    formatters: {
      level: (label, numericLevel): { level: string } => {
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
