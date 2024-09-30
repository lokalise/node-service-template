import pino, { type Logger, levels, type Level } from 'pino'
import pretty from 'pino-pretty'

import { type AppConfig, isProduction } from './config.js'

export function resolveLoggerConfiguration(appConfig: AppConfig): Logger {
  if (!isProduction()) {
    return pino(
      pretty({
        sync: true,
        minimumLevel: appConfig.logLevel as Level,
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'hostname,pid',
      }),
    )
  }

  return pino({
    level: appConfig.logLevel,
    formatters: {
      level: (_label, numericLevel): { level: string } => {
        const level = levels.labels[numericLevel] || 'unknown'
        return { level }
      },
    },
  })
}
