import type { JWT } from '@fastify/jwt'
import type { Amplitude, NewRelicTransactionManager } from '@lokalise/fastify-extras'
import { reportErrorToBugsnag } from '@lokalise/fastify-extras'
import type { ErrorReporter, ErrorResolver } from '@lokalise/node-core'
import { globalLogger, InternalError } from '@lokalise/node-core'
import { AmqpConsumerErrorResolver } from '@message-queue-toolkit/amqp'
import { PrismaClient } from '@prisma/client'
import type { Connection } from 'amqplib'
import type { Resolver } from 'awilix'
import { asClass, asFunction, Lifetime } from 'awilix'
import type { FastifyBaseLogger } from 'fastify'
import Redis from 'ioredis'
import type P from 'pino'
import { pino } from 'pino'
import { ToadScheduler } from 'toad-scheduler'

import { FakeStoreApiClient } from '../integrations/FakeStoreApiClient'

import { getConfig } from './config'
import type { Config } from './config'
import type { ExternalDependencies } from './diConfig'
import { SINGLETON_CONFIG } from './diConfig'

export type CommonDiConfig = Record<keyof CommonDependencies, Resolver<unknown>>

export function resolveCommonDiConfig(
  dependencies: ExternalDependencies = { logger: globalLogger },
): CommonDiConfig {
  return {
    jwt: asFunction(() => {
      return dependencies.app?.jwt
    }, SINGLETON_CONFIG),
    logger: asFunction(() => dependencies.logger ?? pino(), SINGLETON_CONFIG),

    scheduler: asFunction(() => {
      return dependencies.app?.scheduler ?? new ToadScheduler()
    }, SINGLETON_CONFIG),

    redis: asFunction(
      ({ config }: CommonDependencies) => {
        const redisConfig = config.redis

        return new Redis({
          host: redisConfig.host,
          db: redisConfig.db,
          port: redisConfig.port,
          username: redisConfig.username,
          password: redisConfig.password,
          connectTimeout: redisConfig.connectTimeout,
          commandTimeout: redisConfig.commandTimeout,
          tls: redisConfig.useTls ? {} : undefined,
        })
      },
      {
        dispose: (redis) => {
          return new Promise((resolve) => {
            void redis.quit((err, result) => {
              if (err) {
                globalLogger.error(`Error while closing redis: ${err.message}`)
                return resolve(err)
              }
              return resolve(result)
            })
          })
        },
        lifetime: Lifetime.SINGLETON,
      },
    ),

    redisPublisher: asFunction(
      ({ config }: CommonDependencies) => {
        const redisConfig = config.redis

        return new Redis({
          host: redisConfig.host,
          db: redisConfig.db,
          port: redisConfig.port,
          username: redisConfig.username,
          password: redisConfig.password,
          connectTimeout: redisConfig.connectTimeout,
          commandTimeout: redisConfig.commandTimeout,
          tls: redisConfig.useTls ? {} : undefined,
        })
      },
      {
        dispose: (redis) => {
          return new Promise((resolve) => {
            void redis.quit((err, result) => {
              if (err) {
                globalLogger.error(`Error while closing redis: ${err.message}`)
                return resolve(err)
              }
              return resolve(result)
            })
          })
        },
        lifetime: Lifetime.SINGLETON,
      },
    ),

    redisConsumer: asFunction(
      ({ config }: CommonDependencies) => {
        const redisConfig = config.redis

        return new Redis({
          host: redisConfig.host,
          db: redisConfig.db,
          port: redisConfig.port,
          username: redisConfig.username,
          password: redisConfig.password,
          connectTimeout: redisConfig.connectTimeout,
          commandTimeout: redisConfig.commandTimeout,
          tls: redisConfig.useTls ? {} : undefined,
        })
      },
      {
        dispose: (redis) => {
          return new Promise((resolve) => {
            void redis.quit((err, result) => {
              if (err) {
                globalLogger.error(`Error while closing redis: ${err.message}`)
                return resolve(err)
              }
              return resolve(result)
            })
          })
        },
        lifetime: Lifetime.SINGLETON,
      },
    ),

    prisma: asFunction(
      ({ config }: CommonDependencies) => {
        return new PrismaClient({
          datasources: {
            db: {
              url: config.db.databaseUrl,
            },
          },
        })
      },
      {
        dispose: (prisma) => {
          return prisma.$disconnect()
        },
        lifetime: Lifetime.SINGLETON,
      },
    ),

    amqpConnection: asFunction(
      () => {
        if (!dependencies.amqpConnection) {
          throw new InternalError({
            message: 'amqp connection is a mandatory dependency',
            errorCode: 'MISSING_DEPENDENCY',
          })
        }
        return dependencies.amqpConnection
      },
      {
        lifetime: Lifetime.SINGLETON,
        dispose: (connection) => {
          return connection.close()
        },
      },
    ),
    consumerErrorResolver: asFunction(() => {
      return new AmqpConsumerErrorResolver()
    }),

    config: asFunction(() => {
      return getConfig()
    }, SINGLETON_CONFIG),

    // vendor-specific dependencies
    newRelicBackgroundTransactionManager: asFunction(() => {
      return dependencies.app?.newrelicTransactionManager
    }, SINGLETON_CONFIG),
    amplitude: asFunction(() => {
      return dependencies.app?.amplitude
    }, SINGLETON_CONFIG),
    errorReporter: asFunction(() => {
      return {
        report: (report) => reportErrorToBugsnag(report),
      } satisfies ErrorReporter
    }),
    fakeStoreApiClient: asClass(FakeStoreApiClient, SINGLETON_CONFIG),
  }
}

export type CommonDependencies = {
  jwt: JWT
  config: Config
  logger: FastifyBaseLogger & P.Logger
  scheduler: ToadScheduler

  redis: Redis
  redisPublisher: Redis
  redisConsumer: Redis
  prisma: PrismaClient

  amqpConnection: Connection

  // vendor-specific dependencies
  newRelicBackgroundTransactionManager: NewRelicTransactionManager
  amplitude: Amplitude

  errorReporter: ErrorReporter
  consumerErrorResolver: ErrorResolver

  fakeStoreApiClient: FakeStoreApiClient
}
