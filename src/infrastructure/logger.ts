import type { PinoLoggerOptions } from 'fastify/types/logger'
import pino, { type Level, levels, type Logger } from 'pino'
import pretty from 'pino-pretty'

import type { AppConfig } from './config.js'
import { isProduction } from './config.js'

export function resolveLoggerConfiguration(
  appConfig: AppConfig,
): PinoLoggerOptions | Logger | boolean {
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

  return {
    level: appConfig.logLevel,
    formatters: {
      level: (_label, numericLevel): { level: string } => {
        const level = levels.labels[numericLevel] || 'unknown'
        return { level }
      },
    },
  } satisfies PinoLoggerOptions
}
