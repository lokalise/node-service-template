import { ConfigScope } from '@lokalise/node-core'
import type { RedisConfig } from '@lokalise/node-core'

import type { AwsConfig } from './aws/awsConfig.ts'
import { getAwsConfig } from './aws/awsConfig.ts'

const configScope: ConfigScope = new ConfigScope()
export const SERVICE_NAME = 'node-service-template'

export type IntervalJobConfig = {
  periodInSeconds: number
}

export type CronJobConfig = {
  cronExpression: string
}

export type Config = {
  app: AppConfig
  db: DbConfig
  aws: AwsConfig
  redis: RedisConfig
  scheduler: RedisConfig
  amqp: AmqpConfig
  integrations: {
    fakeStore: {
      baseUrl: string
    }
  }
  jobs: JobConfig
  vendors: {
    newrelic: {
      isEnabled: boolean
      appName: string
    }
    bugsnag: {
      isEnabled: boolean
      apiKey?: string
      appType?: string
    }
    amplitude: {
      isEnabled: boolean
      apiKey?: string
      serverZone: string
      flushIntervalMillis?: number
      flushMaxRetries?: number
      flushQueueSize?: number
    }
  }
}

export type JobConfig = {
  processLogFilesJob: IntervalJobConfig
  deleteOldUsersJob: IntervalJobConfig
  sendEmailsJob: CronJobConfig
}

export type DbConfig = {
  databaseUrl: string
}

export type AmqpConfig = {
  hostname: string
  port: number
  username: string
  password: string
  vhost: string
  useTls: boolean
}

export type AppConfig = {
  port: number
  bindAddress: string
  jwtPublicKey: string
  logLevel: 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace' | 'silent'
  nodeEnv: 'production' | 'development' | 'test'
  appEnv: 'production' | 'development' | 'staging'
  appVersion: string
  gitCommitSha: string
  baseUrl: string
  metrics: {
    isEnabled: boolean
  }
}

let config: Config
export function getConfig(): Config {
  if (!config) {
    config = generateConfig()
  }
  return config
}

export function generateConfig(): Config {
  return {
    app: getAppConfig(),
    db: getDbConfig(),
    aws: getAwsConfig(configScope),
    redis: getRedisConfig(),
    amqp: getAmqpConfig(),
    scheduler: getSchedulerConfig(),
    integrations: {
      fakeStore: {
        baseUrl: configScope.getMandatory('SAMPLE_FAKE_STORE_BASE_URL'),
      },
    },
    jobs: {
      deleteOldUsersJob: {
        periodInSeconds: configScope.getMandatoryInteger('DELETE_OLD_USERS_JOB_PERIOD_IN_SECS'),
      },
      processLogFilesJob: {
        periodInSeconds: configScope.getMandatoryInteger('PROCESS_LOGS_FILES_JOB_PERIOD_IN_SECS'),
      },
      sendEmailsJob: {
        cronExpression: configScope.getMandatory('SEND_EMAILS_JOB_CRON'),
      },
    },
    vendors: {
      newrelic: {
        isEnabled: configScope.getOptionalBoolean('NEW_RELIC_ENABLED', true),
        appName: configScope.getOptionalNullable('NEW_RELIC_APP_NAME', ''),
      },
      bugsnag: {
        isEnabled: configScope.getOptionalBoolean('BUGSNAG_ENABLED', true),
        apiKey: configScope.getOptionalNullable('BUGSNAG_KEY', undefined),
        appType: configScope.getOptionalNullable('BUGSNAG_APP_TYPE', undefined),
      },
      amplitude: {
        isEnabled: configScope.getOptionalBoolean('AMPLITUDE_ENABLED', false),
        apiKey: configScope.getOptionalNullable('AMPLITUDE_KEY', undefined),
        serverZone: configScope.getOptionalOneOf('AMPLITUDE_SERVER_ZONE', 'EU', ['EU', 'US']),
        flushIntervalMillis: configScope.getOptionalInteger(
          'AMPLITUDE_FLUSH_INTERVAL_MILLIS',
          10_000,
        ),
        flushQueueSize: configScope.getOptionalInteger('AMPLITUDE_FLUSH_QUEUE_SIZE', 300),
        flushMaxRetries: configScope.getOptionalInteger('AMPLITUDE_FLUSH_MAX_RETRIES', 12),
      },
    },
  }
}

export function getAmqpConfig(): AmqpConfig {
  return {
    hostname: configScope.getMandatory('AMQP_HOSTNAME'),
    port: configScope.getMandatoryInteger('AMQP_PORT'),
    username: configScope.getMandatory('AMQP_USERNAME'),
    password: configScope.getMandatory('AMQP_PASSWORD'),
    vhost: configScope.getOptional('AMQP_VHOST', ''),
    useTls: configScope.getOptionalBoolean('AMQP_USE_TLS', true),
  }
}

export function getDbConfig(): DbConfig {
  return {
    databaseUrl: configScope.getMandatory('DATABASE_URL'),
  }
}

export function getRedisConfig(): RedisConfig {
  return {
    host: configScope.getMandatory('REDIS_HOST'),
    keyPrefix: configScope.getMandatory('REDIS_KEY_PREFIX'),
    port: configScope.getMandatoryInteger('REDIS_PORT'),
    username: configScope.getOptionalNullable('REDIS_USERNAME', undefined),
    password: configScope.getOptionalNullable('REDIS_PASSWORD', undefined),
    useTls: configScope.getOptionalBoolean('REDIS_USE_TLS', true),
    commandTimeout: configScope.getOptionalNullableInteger('REDIS_COMMAND_TIMEOUT', undefined),
    connectTimeout: configScope.getOptionalNullableInteger('REDIS_CONNECT_TIMEOUT', undefined),
  }
}

export function getSchedulerConfig(): RedisConfig {
  return {
    host: configScope.getMandatory('SCHEDULER_REDIS_HOST'),
    keyPrefix: configScope.getMandatory('SCHEDULER_REDIS_KEY_PREFIX'),
    port: configScope.getMandatoryInteger('SCHEDULER_REDIS_PORT'),
    username: configScope.getOptionalNullable('SCHEDULER_REDIS_USERNAME', undefined),
    password: configScope.getOptionalNullable('SCHEDULER_REDIS_PASSWORD', undefined),
    useTls: configScope.getOptionalBoolean('REDIS_USE_TLS', true),
    commandTimeout: configScope.getOptionalNullableInteger(
      'SCHEDULER_REDIS_COMMAND_TIMEOUT',
      undefined,
    ),
    connectTimeout: configScope.getOptionalNullableInteger(
      'SCHEDULER_REDIS_CONNECT_TIMEOUT',
      undefined,
    ),
  }
}

export function getAppConfig(): AppConfig {
  return {
    port: configScope.getOptionalInteger('APP_PORT', 3000),
    bindAddress: configScope.getMandatory('APP_BIND_ADDRESS'),
    jwtPublicKey: decodeJwtConfig(configScope.getMandatory('JWT_PUBLIC_KEY')),
    logLevel: configScope.getMandatoryOneOf('LOG_LEVEL', [
      'fatal',
      'error',
      'warn',
      'info',
      'debug',
      'trace',
      'silent',
    ]),
    nodeEnv: configScope.getOptionalOneOf('NODE_ENV', 'production', [
      'production',
      'development',
      'test',
    ]),
    appEnv: configScope.getMandatoryOneOf('APP_ENV', ['production', 'development', 'staging']),
    appVersion: configScope.getOptional('APP_VERSION', 'VERSION_NOT_SET'),
    baseUrl: configScope.getOptional('BASE_URL', ''),
    gitCommitSha: configScope.getOptional('GIT_COMMIT_SHA', 'COMMIT_SHA_NOT_SET'),
    metrics: {
      isEnabled: configScope.getOptionalBoolean('METRICS_ENABLED', !configScope.isDevelopment()),
    },
  }
}

export function isDevelopment() {
  return configScope.isDevelopment()
}

export function isTest() {
  return configScope.isTest()
}

export function isProduction() {
  return configScope.isProduction()
}

export function decodeJwtConfig(jwtPublicKey: string) {
  return jwtPublicKey.replaceAll('||', '\n')
}
