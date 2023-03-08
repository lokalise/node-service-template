import type http from 'http'

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
  bugsnagPlugin,
  getRequestIdFastifyAppConfig,
  metricsPlugin,
  newrelicTransactionManagerPlugin,
  prismaOtelTracingPlugin,
  requestContextProviderPlugin,
} from '@lokalise/fastify-extras'
import type { AwilixContainer } from 'awilix'
import fastify from 'fastify'
import type { FastifyInstance, FastifyBaseLogger } from 'fastify'
import customHealthCheck from 'fastify-custom-healthcheck'
import fastifyGracefulShutdown from 'fastify-graceful-shutdown'
import fastifyNoIcon from 'fastify-no-icon'
import {
  createJsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
} from 'fastify-type-provider-zod'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import type pino from 'pino'

import { resolveAmqpConnection } from './infrastructure/amqp/amqpConnectionResolver'
import {
  getAmqpConfig,
  getConfig,
  isDevelopment,
  isProduction,
  isTest,
} from './infrastructure/config'
import type { DependencyOverrides } from './infrastructure/diConfig'
import { registerDependencies } from './infrastructure/diConfig'
import { errorHandler } from './infrastructure/errors/errorHandler'
import { resolveGlobalErrorLogObject } from './infrastructure/errors/globalErrorHandler'
import { runAllHealthchecks } from './infrastructure/healthchecks'
import { resolveLoggerConfiguration } from './infrastructure/logger'
import { getConsumers } from './modules/consumers'
import { registerJobs } from './modules/jobs'
import { getRoutes } from './modules/routes'
import { healthcheckPlugin } from './plugins/healthcheckPlugin'
import { jwtTokenPlugin } from './plugins/jwtTokenPlugin'

const GRACEFUL_SHUTDOWN_TIMEOUT_IN_MSECS = 10000

export type ConfigOverrides = {
  diContainer?: AwilixContainer
  jwtKeys?: {
    public: Secret
    private: Secret
  }
  amqpEnabled?: boolean
  jobsEnabled?: boolean
  healthchecksEnabled?: boolean
}

export type RequestContext = {
  logger?: FastifyBaseLogger
  reqId: string
}

export async function getApp(
  configOverrides: ConfigOverrides = {},
  dependencyOverrides: DependencyOverrides = {},
): Promise<FastifyInstance<http.Server, http.IncomingMessage, http.ServerResponse, pino.Logger>> {
  const config = getConfig()
  const appConfig = config.app
  const loggerConfig = resolveLoggerConfiguration(appConfig)
  const enableRequestLogging = ['debug', 'trace'].includes(appConfig.logLevel)

  const app = fastify<http.Server, http.IncomingMessage, http.ServerResponse, pino.Logger>({
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
    void app.register(fastifyCors, {
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

  void app.register(
    fastifyHelmet,
    isDevelopment()
      ? {
          contentSecurityPolicy: false,
        }
      : {},
  )

  void app.register(fastifyGracefulShutdown, {
    resetHandlersOnInit: true,
    timeout: GRACEFUL_SHUTDOWN_TIMEOUT_IN_MSECS,
  })

  void app.register(fastifyNoIcon)

  void app.register(fastifyAuth)
  void app.register(fastifySwagger, {
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

  void app.register(fastifySwaggerUi)
  void app.register(fastifyAwilixPlugin, { disposeOnClose: true })
  void app.register(fastifySchedule)

  void app.register(fastifyJWT, {
    secret: configOverrides.jwtKeys ?? {
      private: '-', // Private key blank, as this service won't create JWT tokens, only verify them
      public: appConfig.jwtPublicKey,
    },
  })

  void app.register(jwtTokenPlugin, {
    skipList: new Set([
      '/login',
      '/access-token',
      '/refresh-token',
      '/documentation',
      '/documentation/json',
      '/documentation/static/*',
      '/documentation/static/swagger-initializer.js',
      '/health',
      '/metrics',
    ]),
  })

  app.setErrorHandler(errorHandler)

  /**
   * Running consumers introduces additional overhead and fragility when running tests,
   * so we avoid doing that unless we intend to actually use them
   */
  const isAmqpEnabled = isProduction() || configOverrides.amqpEnabled
  const amqpConfig = getAmqpConfig()
  const amqpConnection = isAmqpEnabled ? await resolveAmqpConnection(amqpConfig) : undefined

  registerDependencies(
    configOverrides.diContainer ?? diContainer,
    {
      app: app,
      amqpConnection: amqpConnection,
      logger: app.log,
    },
    dependencyOverrides,
  )

  void app.register(customHealthCheck, {
    path: '/health',
    logLevel: 'warn',
    info: {
      env: appConfig.nodeEnv,
      app_version: appConfig.appVersion,
      git_commit_sha: appConfig.gitCommitSha,
    },
    schema: false,
    exposeFailure: false,
  })
  void app.register(healthcheckPlugin)
  void app.register(requestContextProviderPlugin)

  // Vendor-specific plugins
  if (appConfig.metrics.isEnabled) {
    void app.register(metricsPlugin, {
      bindAddress: appConfig.bindAddress,
      errorObjectResolver: resolveGlobalErrorLogObject,
      loggerOptions: loggerConfig,
      disablePrometheusRequestLogging: true,
    })
  }
  void app.register(newrelicTransactionManagerPlugin, {
    isEnabled: config.vendors.newrelic.isEnabled,
  })
  void app.register(bugsnagPlugin, {
    isEnabled: config.vendors.bugsnag.isEnabled,
    bugsnag: {
      apiKey: config.vendors.bugsnag.apiKey ?? '',
      releaseStage: appConfig.appEnv,
    },
  })
  void app.register(prismaOtelTracingPlugin, {
    isEnabled: config.vendors.newrelic.isEnabled,
    samplingRatio: isProduction() ? 0.1 : 1.0,
    serviceName: config.vendors.newrelic.appName,
    useBatchSpans: isProduction(),
  })

  app.after(() => {
    // Register routes
    const { routes } = getRoutes()
    routes.forEach((route) => app.withTypeProvider<ZodTypeProvider>().route(route))

    // Graceful shutdown hook
    app.gracefulShutdown((signal, next) => {
      app.log.info('Starting graceful shutdown')
      next()
    })

    // Register background jobs
    if (configOverrides.jobsEnabled !== false && !isTest()) {
      app.log.info('Start registering background jobs')
      registerJobs(app)
      app.log.info('Background jobs registered')
    } else {
      app.log.info('Skip registering background jobs')
    }

    if (isAmqpEnabled) {
      // This is needed to ensure it gets initialized
      app.diContainer.cradle.amqpConnectionDisposer

      const consumers = getConsumers(app.diContainer.cradle)
      for (const consumer of consumers) {
        void consumer.consume()
      }
    }
  })

  try {
    await app.ready()
    if (!isTest() && configOverrides.healthchecksEnabled !== false) {
      await runAllHealthchecks(app.diContainer.cradle)
    }
  } catch (err) {
    app.log.error('Error while initializing app: ', err)
    throw err
  }

  return app
}
