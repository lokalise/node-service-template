/* eslint-disable max-statements */

import { EventEmitter } from 'node:events'
import type http from 'node:http'

import type { ServerZoneType } from '@amplitude/analytics-types'
import fastifyAuth from '@fastify/auth'
import { diContainer, fastifyAwilixPlugin } from '@fastify/awilix'
import { fastifyCors } from '@fastify/cors'
import fastifyHelmet from '@fastify/helmet'
import type { Secret } from '@fastify/jwt'
import fastifyJWT from '@fastify/jwt'
import fastifySchedule from '@fastify/schedule'
import fastifySwagger from '@fastify/swagger'
import fastifySwaggerUi from '@fastify/swagger-ui'
import {
  amplitudePlugin,
  bugsnagPlugin,
  getRequestIdFastifyAppConfig,
  healthcheckMetricsPlugin,
  metricsPlugin,
  newrelicTransactionManagerPlugin,
  prismaOtelTracingPlugin,
  publicHealthcheckPlugin,
  requestContextProviderPlugin,
} from '@lokalise/fastify-extras'
import type { CommonLogger } from '@lokalise/node-core'
import { resolveGlobalErrorLogObject } from '@lokalise/node-core'
import type { AwilixContainer } from 'awilix'
import fastify from 'fastify'
import type { FastifyInstance } from 'fastify'
import customHealthCheck from 'fastify-custom-healthcheck'
import fastifyGracefulShutdown from 'fastify-graceful-shutdown'
import fastifyNoIcon from 'fastify-no-icon'
import {
  createJsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
} from 'fastify-type-provider-zod'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'

import { getConfig, isDevelopment, isProduction, isTest } from './infrastructure/config.js'
import { errorHandler } from './infrastructure/errors/errorHandler.js'
import {
  dbHealthCheck,
  redisHealthCheck,
  registerHealthChecks,
  runAllHealthchecks,
  wrapHealthCheckForPrometheus,
} from './infrastructure/healthchecks.js'
import { resolveLoggerConfiguration } from './infrastructure/logger.js'
import { registerDependencies } from './infrastructure/parentDiConfig.js'
import type { DependencyOverrides } from './infrastructure/parentDiConfig.js'
import { getRoutes } from './modules/routes.js'
import { jwtTokenPlugin } from './plugins/jwtTokenPlugin.js'

EventEmitter.defaultMaxListeners = 12

const GRACEFUL_SHUTDOWN_TIMEOUT_IN_MSECS = 10000

export type AppInstance = FastifyInstance<
  http.Server,
  http.IncomingMessage,
  http.ServerResponse,
  CommonLogger
>

export type ConfigOverrides = {
  diContainer?: AwilixContainer
  jwtKeys?: {
    public: Secret
    private: Secret
  }
  queuesEnabled?: boolean | string[]
  jobsEnabled?: boolean | string[]
  healthchecksEnabled?: boolean
  monitoringEnabled?: boolean
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: This is intentional
export async function getApp(
  configOverrides: ConfigOverrides = {},
  dependencyOverrides: DependencyOverrides = {},
): Promise<AppInstance> {
  const config = getConfig()
  const appConfig = config.app
  const loggerConfig = resolveLoggerConfiguration(appConfig)
  const enableRequestLogging = ['debug', 'trace'].includes(appConfig.logLevel)

  const app = fastify<http.Server, http.IncomingMessage, http.ServerResponse, CommonLogger>({
    ...getRequestIdFastifyAppConfig(),
    logger: loggerConfig,
    disableRequestLogging: !enableRequestLogging,
  })

  app.setValidatorCompiler(validatorCompiler)
  app.setSerializerCompiler(serializerCompiler)

  // In production this should ideally be handled outside of application, e. g.
  // on nginx or kubernetes level, but for local development it is convenient
  // to have these headers set by application.
  // If this service is never called from the browser, this entire block can be removed.
  if (isDevelopment()) {
    await app.register(fastifyCors, {
      origin: '*',
      credentials: true,
      methods: ['GET', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Origin', 'X-Requested-With', 'Accept', 'Content-Type', 'Authorization'],
      exposedHeaders: [
        'Access-Control-Allow-Origin',
        'Access-Control-Allow-Methods',
        'Access-Control-Allow-Headers',
      ],
    })
  }

  await app.register(
    fastifyHelmet,
    isDevelopment()
      ? {
          contentSecurityPolicy: false,
        }
      : {},
  )

  if (!isDevelopment()) {
    await app.register(fastifyGracefulShutdown, {
      resetHandlersOnInit: true,
      timeout: GRACEFUL_SHUTDOWN_TIMEOUT_IN_MSECS,
    })
  }

  await app.register(fastifyNoIcon)

  await app.register(fastifyAuth)
  await app.register(fastifySwagger, {
    transform: createJsonSchemaTransform({
      skipList: [
        '/documentation/',
        '/documentation/initOAuth',
        '/documentation/json',
        '/documentation/uiConfig',
        '/documentation/yaml',
        '/documentation/*',
        '/documentation/static/*',
        '*',
      ],
    }),
    openapi: {
      info: {
        title: 'SampleApi',
        description: 'Sample backend service',
        version: '1.0.0',
      },
      servers: [
        {
          url: `http://${
            appConfig.bindAddress === '0.0.0.0' ? 'localhost' : appConfig.bindAddress
          }:${appConfig.port}`,
        },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
        },
      },
    },
  })

  await app.register(fastifySwaggerUi)
  await app.register(fastifyAwilixPlugin, {
    disposeOnClose: true,
    asyncDispose: true,
    asyncInit: true,
    eagerInject: true,
    disposeOnResponse: false,
  })
  await app.register(fastifySchedule)

  await app.register(fastifyJWT, {
    secret: configOverrides.jwtKeys ?? {
      private: '-', // Private key blank, as this service won't create JWT tokens, only verify them
      public: appConfig.jwtPublicKey,
    },
  })

  await app.register(jwtTokenPlugin, {
    skipList: new Set([
      '/login',
      '/access-token',
      '/refresh-token',
      '/documentation',
      '/documentation/json',
      '/documentation/static/*',
      '/documentation/static/index.html',
      '/documentation/static/swagger-initializer.js',
      '/',
      '/health',
      '/metrics',
    ]),
  })

  app.setErrorHandler(errorHandler)

  registerDependencies(
    configOverrides.diContainer ?? diContainer,
    {
      app,
      logger: app.log,
    },
    dependencyOverrides,
    /**
     * Running consumers and jobs introduces additional overhead and fragility when running tests,
     * so we avoid doing that unless we intend to actually use them
     */
    {
      queuesEnabled: !!configOverrides.queuesEnabled,
      jobsEnabled: !!configOverrides.jobsEnabled,
    },
  )

  if (configOverrides.monitoringEnabled) {
    await app.register(metricsPlugin, {
      bindAddress: appConfig.bindAddress,
      errorObjectResolver: resolveGlobalErrorLogObject,
      loggerOptions: loggerConfig,
      disablePrometheusRequestLogging: true,
    })
  }

  if (configOverrides.healthchecksEnabled !== false) {
    await app.register(customHealthCheck, {
      path: '/',
      logLevel: 'warn',
      info: {
        env: appConfig.nodeEnv,
        app_version: appConfig.appVersion,
        git_commit_sha: appConfig.gitCommitSha,
      },
      schema: false,
      exposeFailure: false,
    })
    await app.register(publicHealthcheckPlugin, {
      url: '/health',
      healthChecks: [
        {
          name: 'postgres',
          isMandatory: true,
          checker: dbHealthCheck,
        },
        {
          name: 'redis',
          isMandatory: true,
          checker: redisHealthCheck,
        },
      ],
      responsePayload: {
        version: appConfig.appVersion,
        gitCommitSha: appConfig.gitCommitSha,
      },
    })

    if (configOverrides.monitoringEnabled) {
      await app.register(healthcheckMetricsPlugin, {
        healthChecks: [
          wrapHealthCheckForPrometheus(redisHealthCheck, 'redis'),
          wrapHealthCheckForPrometheus(dbHealthCheck, 'postgres'),
        ],
      })
    }
  }
  await app.register(requestContextProviderPlugin)

  // Vendor-specific plugins
  await app.register(newrelicTransactionManagerPlugin, {
    isEnabled: config.vendors.newrelic.isEnabled,
  })
  await app.register(bugsnagPlugin, {
    isEnabled: config.vendors.bugsnag.isEnabled,
    bugsnag: {
      apiKey: config.vendors.bugsnag.apiKey ?? '',
      releaseStage: appConfig.appEnv,
      appVersion: appConfig.appVersion,
      ...(config.vendors.bugsnag.appType && { appType: config.vendors.bugsnag.appType }),
    },
  })
  await app.register(prismaOtelTracingPlugin, {
    isEnabled: config.vendors.newrelic.isEnabled,
    samplingRatio: isProduction() ? 0.1 : 1.0,
    serviceName: config.vendors.newrelic.appName,
    useBatchSpans: isProduction(),
  })
  await app.register(amplitudePlugin, {
    isEnabled: config.vendors.amplitude.isEnabled,
    apiKey: config.vendors.amplitude.apiKey,
    options: {
      serverZone: config.vendors.amplitude.serverZone as ServerZoneType,
      flushIntervalMillis: config.vendors.amplitude.flushIntervalMillis,
      flushMaxRetries: config.vendors.amplitude.flushMaxRetries,
      flushQueueSize: config.vendors.amplitude.flushQueueSize,
    },
  })

  app.after(() => {
    // Register routes
    const { routes } = getRoutes()
    for (const route of routes) {
      app.withTypeProvider<ZodTypeProvider>().route(route)
    }

    // Graceful shutdown hook
    if (!isDevelopment()) {
      app.gracefulShutdown((_signal, next) => {
        app.log.info('Starting graceful shutdown')
        next()
      })
    }

    if (configOverrides.healthchecksEnabled !== false) {
      registerHealthChecks(app)
    }
  })

  try {
    await app.ready()
    if (!isTest() && configOverrides.healthchecksEnabled !== false) {
      await runAllHealthchecks(app)
    }
  } catch (err) {
    app.log.error('Error while initializing app: ', err)
    throw err
  }

  return app
}
