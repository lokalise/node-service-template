import { ConfigScope, createRangeValidator } from '@lokalise/node-core'
import type { RedisConfig } from '@lokalise/node-core'

const configScope: ConfigScope = new ConfigScope()
const redisDbValidator = createRangeValidator(0, 15)

export type Config = {
  db: DbConfig
  redis: RedisConfig
  scheduler: RedisConfig
  amqp: AmqpConfig
  integrations: {
    fakeStore: {
      baseUrl: string
    }
  }
  app: AppConfig
  jobs: JobConfig
  vendors: {
    newrelic: {
      isEnabled: boolean
      appName: string
    }
    bugsnag: {
      isEnabled: boolean
      apiKey?: string
    }
  }
}

export type JobConfig = {
  processLogFilesJob: {
    periodInSeconds: number
  }
  deleteOldUsersJob: {
    periodInSeconds: number
  }
  sendEmailsJob: {
    cronExpression: string
  }
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
  metrics: {
    isEnabled: boolean
  }
}

export function getConfig(): Config {
  return {
    app: getAppConfig(),
    db: getDbConfig(),
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
    db: configScope.getMandatoryValidatedInteger('REDIS_DB', redisDbValidator),
    port: configScope.getMandatoryInteger('REDIS_PORT'),
    username: configScope.getOptionalNullable('REDIS_USERNAME', undefined),
    password: configScope.getOptionalNullable('REDIS_PASSWORD', undefined),
    useTls: configScope.getOptionalBoolean('REDIS_USE_TLS', true),
  }
}

export function getSchedulerConfig(): RedisConfig {
  return {
    host: configScope.getMandatory('SCHEDULER_REDIS_HOST'),
    db: configScope.getMandatoryValidatedInteger('SCHEDULER_REDIS_DB', redisDbValidator),
    port: configScope.getMandatoryInteger('SCHEDULER_REDIS_PORT'),
    username: configScope.getOptionalNullable('SCHEDULER_REDIS_USERNAME', undefined),
    password: configScope.getOptionalNullable('SCHEDULER_REDIS_PASSWORD', undefined),
    useTls: configScope.getOptionalBoolean('REDIS_USE_TLS', true),
  }
}

export function getAppConfig(): AppConfig {
  return {
    port: configScope.getOptionalInteger('APP_PORT', 3000),
    bindAddress: configScope.getMandatory('APP_BIND_ADDRESS'),
    jwtPublicKey: configScope.getMandatory('JWT_PUBLIC_KEY').replaceAll('||', '\n'),
    logLevel: configScope.getMandatoryOneOf('LOG_LEVEL', [
      'fatal',
      'error',
      'warn',
      'info',
      'debug',
      'trace',
      'silent',
    ]),
    nodeEnv: configScope.getMandatoryOneOf('NODE_ENV', ['production', 'development', 'test']),
    appEnv: configScope.getMandatoryOneOf('APP_ENV', ['production', 'development', 'staging']),
    appVersion: configScope.getOptional('APP_VERSION', 'VERSION_NOT_SET'),
    gitCommitSha: configScope.getOptional('GIT_COMMIT_SHA', 'COMMIT_SHA_NOT_SET'),
    metrics: {
      isEnabled: configScope.getOptionalBoolean('METRICS_ENABLED', true),
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
