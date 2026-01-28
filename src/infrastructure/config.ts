import { getEnvaseAwsConfig } from '@lokalise/aws-config'
import { detectNodeEnv, envvar, type InferEnv, parseEnv } from 'envase'
import { z } from 'zod'

function setZodPortChecks<T extends z.ZodCoercedNumber>(schema: T) {
  return schema.int().min(0).max(65535)
}

export const nodeEnv = detectNodeEnv(process.env)

export const SERVICE_NAME = 'node-service-template'

export function decodeJwtConfig(jwtPublicKey: string) {
  return jwtPublicKey.replaceAll('||', '\n')
}

const envSchema = {
  app: {
    nodeEnv: envvar(
      'NODE_ENV',
      z.enum(['production', 'test', 'development']).describe('Application execution environment'),
    ),
    appEnv: envvar(
      'APP_ENV',
      z
        .enum(['production', 'staging', 'development'])
        .describe('Deployment environment for the application'),
    ),
    appVersion: envvar(
      'APP_VERSION',
      z
        .string()
        .default('VERSION_NOT_SET')
        .describe('Application version exposed via healthcheck endpoint'),
    ),
    gitCommitSha: envvar(
      'GIT_COMMIT_SHA',
      z.string().default('COMMIT_SHA_NOT_SET').describe('Git commit SHA of the deployed version'),
    ),
    port: envvar(
      'APP_PORT',
      z.coerce
        .number()
        .apply(setZodPortChecks)
        .default(3000)
        .describe('HTTP server listening port'),
    ),
    bindAddress: envvar(
      'APP_BIND_ADDRESS',
      z.string().describe('HTTP server binding address (e.g., 0.0.0.0 for all interfaces)'),
    ),
    jwtPublicKey: envvar(
      'JWT_PUBLIC_KEY',
      z
        .string()
        .describe("JWT validation public key (use '||' as newline separator)")
        .transform(decodeJwtConfig),
    ),
    logLevel: envvar(
      'LOG_LEVEL',
      z
        .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
        .describe('Minimum log level for emitted logs'),
    ),
    baseUrl: envvar(
      'BASE_URL',
      z
        .string()
        .default('')
        .describe('Public URL where the application is accessible, used in OpenAPI spec'),
    ),
    metrics: {
      isEnabled: envvar(
        'METRICS_ENABLED',
        z.stringbool().default(true).describe('Whether to enable Prometheus metrics collection'),
      ),
    },
  },
  db: {
    databaseUrl: envvar(
      'DATABASE_URL',
      z.string().describe('PostgreSQL connection URL including credentials and database name'),
    ),
  },
  redis: {
    host: envvar('REDIS_HOST', z.string().describe('Redis server hostname')),
    keyPrefix: envvar('REDIS_KEY_PREFIX', z.string().describe('Prefix for all Redis keys')),
    port: envvar(
      'REDIS_PORT',
      z.coerce.number().apply(setZodPortChecks).describe('Redis server port'),
    ),
    username: envvar(
      'REDIS_USERNAME',
      z.string().optional().describe('Redis authentication username'),
    ),
    password: envvar(
      'REDIS_PASSWORD',
      z.string().optional().describe('Redis authentication password'),
    ),
    useTls: envvar(
      'REDIS_USE_TLS',
      z.stringbool().default(true).describe('Whether to use TLS/SSL for Redis connection'),
    ),
    commandTimeout: envvar(
      'REDIS_COMMAND_TIMEOUT',
      z.coerce
        .number()
        .int()
        .gte(0)
        .optional()
        .describe('Command execution timeout in milliseconds'),
    ),
    connectTimeout: envvar(
      'REDIS_CONNECT_TIMEOUT',
      z.coerce
        .number()
        .int()
        .gte(0)
        .optional()
        .describe('Initial connection timeout in milliseconds'),
    ),
  },
  scheduler: {
    host: envvar('SCHEDULER_REDIS_HOST', z.string().describe('Scheduler Redis server hostname')),
    keyPrefix: envvar(
      'SCHEDULER_REDIS_KEY_PREFIX',
      z.string().describe('Prefix for all scheduler Redis keys'),
    ),
    port: envvar(
      'SCHEDULER_REDIS_PORT',
      z.coerce.number().apply(setZodPortChecks).describe('Scheduler Redis server port'),
    ),
    username: envvar(
      'SCHEDULER_REDIS_USERNAME',
      z.string().optional().describe('Scheduler Redis authentication username'),
    ),
    password: envvar(
      'SCHEDULER_REDIS_PASSWORD',
      z.string().optional().describe('Scheduler Redis authentication password'),
    ),
    useTls: envvar(
      'SCHEDULER_REDIS_USE_TLS',
      z
        .stringbool()
        .default(true)
        .describe('Whether to use TLS/SSL for scheduler Redis connection'),
    ),
    commandTimeout: envvar(
      'SCHEDULER_REDIS_COMMAND_TIMEOUT',
      z.coerce
        .number()
        .int()
        .gte(0)
        .optional()
        .describe('Scheduler command execution timeout in milliseconds'),
    ),
    connectTimeout: envvar(
      'SCHEDULER_REDIS_CONNECT_TIMEOUT',
      z.coerce
        .number()
        .int()
        .gte(0)
        .optional()
        .describe('Scheduler initial connection timeout in milliseconds'),
    ),
  },
  amqp: {
    hostname: envvar('AMQP_HOSTNAME', z.string().describe('AMQP broker hostname')),
    port: envvar(
      'AMQP_PORT',
      z.coerce.number().apply(setZodPortChecks).describe('AMQP broker port'),
    ),
    username: envvar('AMQP_USERNAME', z.string().describe('AMQP broker username')),
    password: envvar('AMQP_PASSWORD', z.string().describe('AMQP broker password')),
    vhost: envvar('AMQP_VHOST', z.string().default('').describe('AMQP broker virtual host')),
    useTls: envvar(
      'AMQP_USE_TLS',
      z.stringbool().default(true).describe('Whether to use TLS/SSL for AMQP connection'),
    ),
  },
  aws: getEnvaseAwsConfig(),
  integrations: {
    fakeStore: {
      baseUrl: envvar(
        'SAMPLE_FAKE_STORE_BASE_URL',
        z.string().describe('Base URL for the fake store API integration'),
      ),
    },
  },
  jobs: {
    deleteOldUsersJob: {
      periodInSeconds: envvar(
        'DELETE_OLD_USERS_JOB_PERIOD_IN_SECS',
        z.coerce.number().int().gte(0).describe('Period in seconds for deleting old users job'),
      ),
    },
    processLogFilesJob: {
      periodInSeconds: envvar(
        'PROCESS_LOGS_FILES_JOB_PERIOD_IN_SECS',
        z.coerce.number().int().gte(0).describe('Period in seconds for processing log files job'),
      ),
    },
    sendEmailsJob: {
      cronExpression: envvar(
        'SEND_EMAILS_JOB_CRON',
        z.string().describe('Cron expression for scheduling the send emails job'),
      ),
    },
  },
  vendors: {
    opentelemetry: {
      isEnabled: envvar(
        'OTEL_ENABLED',
        z.stringbool().default(true).describe('Whether to enable OpenTelemetry instrumentation  '),
      ),
      _resourceAttributes: envvar(
        'OTEL_RESOURCE_ATTRIBUTES',
        z
          .string()
          .regex(
            /^service\.name=[^,]+$/,
            'Must match format: service.name={serviceName}',
          )
          .optional()
          .describe(
            'OpenTelemetry resource attributes in format service.name={serviceName}',
          ),
      ),
      _exporterUrl: envvar(
        'OTEL_EXPORTER_URL',
        z.url().optional().describe('OpenTelemetry exporter endpoint URL'),
      ),
    },
    bugsnag: {
      isEnabled: envvar(
        'BUGSNAG_ENABLED',
        z.stringbool().default(true).describe('Whether to send errors to Bugsnag'),
      ),
      apiKey: envvar(
        'BUGSNAG_KEY',
        z.string().optional().describe('Bugsnag API key for error submission'),
      ),
      appType: envvar(
        'BUGSNAG_APP_TYPE',
        z.string().optional().describe('Application process type identifier for Bugsnag'),
      ),
    },
    amplitude: {
      isEnabled: envvar(
        'AMPLITUDE_ENABLED',
        z.stringbool().default(false).describe('Whether to track analytics with Amplitude'),
      ),
      apiKey: envvar(
        'AMPLITUDE_KEY',
        z.string().optional().describe('Amplitude API key for event submission'),
      ),
      serverZone: envvar(
        'AMPLITUDE_SERVER_ZONE',
        z.enum(['EU', 'US']).default('EU').describe('Amplitude data residency region'),
      ),
      flushIntervalMillis: envvar(
        'AMPLITUDE_FLUSH_INTERVAL_MILLIS',
        z.coerce
          .number()
          .int()
          .gte(0)
          .default(10_000)
          .describe('Event batch upload interval in milliseconds'),
      ),
      flushQueueSize: envvar(
        'AMPLITUDE_FLUSH_QUEUE_SIZE',
        z.coerce.number().int().gte(0).default(300).describe('Maximum events per batch upload'),
      ),
      flushMaxRetries: envvar(
        'AMPLITUDE_FLUSH_MAX_RETRIES',
        z.coerce
          .number()
          .int()
          .gte(0)
          .default(12)
          .describe('Maximum retry attempts for failed uploads'),
      ),
    },
  },
}

// biome-ignore lint/style/noDefaultExport: envase uses default export to generate docs
export default envSchema

export type Config = InferEnv<typeof envSchema>

let config: Config | null = null

export function getConfig(): Config {
  if (!config) {
    config = parseEnv(process.env, envSchema)
  }
  return config
}

export type IntervalJobConfig = {
  periodInSeconds: number
}

export type CronJobConfig = {
  cronExpression: string
}
