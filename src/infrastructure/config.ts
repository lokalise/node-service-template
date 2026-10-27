import { type AwsConfig, getEnvaseAwsConfig } from '@lokalise/aws-config'
import { createAppConfigSchema, createRedisConfigSchema } from '@lokalise/config'
import { type ProfilingConfig, resolveProfilingConfigFromEnv } from '@lokalise/pyroscope-profiling'
import { createConfig, detectNodeEnv, envvar, type InferEnv } from 'envase'
import { z } from 'zod'

function setZodPortChecks<T extends z.ZodCoercedNumber>(schema: T) {
  return schema.int().min(1).max(65535)
}

export const nodeEnv = detectNodeEnv(process.env)

export const SERVICE_NAME = 'node-service-template'

export function decodeJwtConfig(jwtPublicKey: string) {
  return jwtPublicKey.replaceAll('||', '\n')
}

const awsConfig = getEnvaseAwsConfig({ path: 'aws' })

const envSchema = {
  app: {
    ...createAppConfigSchema(),
    jwtPublicKey: envvar(
      'JWT_PUBLIC_KEY',
      z
        .string()
        .describe("JWT validation public key (use '||' as newline separator)")
        .transform(decodeJwtConfig),
    ),
  },
  db: {
    databaseUrl: envvar(
      'DATABASE_URL',
      z.string().describe('PostgreSQL connection URL including credentials and database name'),
    ),
  },
  redis: createRedisConfigSchema(),
  scheduler: createRedisConfigSchema({ prefix: 'SCHEDULER' }),
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
  aws: awsConfig.schema,
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
        z.coerce
          .number()
          .int()
          .gte(0)
          .default(60000)
          .describe('Period in seconds for deleting old users job'),
      ),
    },
    processLogFilesJob: {
      periodInSeconds: envvar(
        'PROCESS_LOGS_FILES_JOB_PERIOD_IN_SECS',
        z.coerce
          .number()
          .int()
          .gte(0)
          .default(6000)
          .describe('Period in seconds for processing log files job'),
      ),
    },
    sendEmailsJob: {
      cronExpression: envvar(
        'SEND_EMAILS_JOB_CRON',
        z
          .string()
          .default('0 * * * *')
          .describe('Cron expression for scheduling the send emails job'),
      ),
    },
  },
  vendors: {
    opentelemetry: {
      isEnabled: envvar(
        'OTEL_ENABLED',
        z.stringbool().default(true).describe('Whether to enable OpenTelemetry instrumentation  '),
      ),
      consoleSpansEnabled: envvar(
        'OTEL_CONSOLE_SPANS_ENABLED',
        z
          .stringbool()
          .default(false)
          .describe(
            'Print OpenTelemetry spans to stdout for local debugging (forced off in production)',
          ),
      ),
      _resourceAttributes: envvar(
        'OTEL_RESOURCE_ATTRIBUTES',
        z
          .string()
          .regex(/^service\.name=[^,]+$/, 'Must match format: service.name={serviceName}')
          .optional()
          .describe('OpenTelemetry resource attributes in format service.name={serviceName}'),
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

const computedSchema = {
  aws: awsConfig.computed,
}

// biome-ignore lint/style/noDefaultExport: envase uses default export to generate docs
export default envSchema

export type Config = Omit<InferEnv<typeof envSchema>, 'aws'> & { aws: AwsConfig }

let config: Config | null = null

export function getConfig(): Config {
  if (!config) {
    config = createConfig(process.env, {
      schema: envSchema,
      computed: computedSchema,
      emptyStringAsUndefined: true,
    })
  }
  return config
}

/**
 * Profiler settings for `startProfiling`, read from `PYROSCOPE_*` by the library itself so
 * its rules (off unless `PYROSCOPE_ENABLED=true`, never under `NODE_ENV=test`, blank values
 * treated as unset) have one source of truth. Deliberately not part of the envase schema:
 * a misconfigured profiler must not stop the service from starting.
 */
export function getProfilingConfig(env: NodeJS.ProcessEnv = process.env): ProfilingConfig {
  return resolveProfilingConfigFromEnv({ appName: SERVICE_NAME, env })
}

export type IntervalJobConfig = {
  periodInSeconds: number
}

export type CronJobConfig = {
  cronExpression: string
}
