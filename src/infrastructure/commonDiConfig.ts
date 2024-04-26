import type { JWT } from '@fastify/jwt'
import type { Amplitude, NewRelicTransactionManager } from '@lokalise/fastify-extras'
import { reportErrorToBugsnag } from '@lokalise/fastify-extras'
import type { CommonLogger, ErrorReporter, ErrorResolver } from '@lokalise/node-core'
import { globalLogger } from '@lokalise/node-core'
import { AmqpConnectionManager, AmqpConsumerErrorResolver } from '@message-queue-toolkit/amqp'
import { PrismaClient } from '@prisma/client'
import type { NameAndRegistrationPair } from 'awilix'
import { asClass, asFunction, Lifetime } from 'awilix'
import Redis from 'ioredis'
import { ToadScheduler } from 'toad-scheduler'

import { FakeStoreApiClient } from '../integrations/FakeStoreApiClient'

import { getAmqpConfig, getConfig } from './config'
import type { Config } from './config'
import type { ExternalDependencies } from './diConfig'
import { SINGLETON_CONFIG } from './diConfig'
import type { DIOptions } from './diConfigUtils'
import { FakeAmplitude } from './fakes/FakeAmplitude'
import { FakeNewrelicTransactionManager } from './fakes/FakeNewrelicTransactionManager'

export function resolveCommonDiConfig(
  dependencies: ExternalDependencies = { logger: globalLogger },
  options: DIOptions = {},
): NameAndRegistrationPair<CommonDependencies> {
  return {
    jwt: asFunction(() => {
      if (!dependencies.app) {
        throw new Error('app with JWT set is necessary to use JWT as a dependency')
      }
      return dependencies.app.jwt
    }, SINGLETON_CONFIG),
    logger: asFunction(() => dependencies.logger, SINGLETON_CONFIG),

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
          maxRetriesPerRequest: null,
          tls: redisConfig.useTls ? {} : undefined,
        })
      },
      {
        dispose: (redis) => {
          return new Promise((resolve) => {
            void redis.quit((_err, result) => {
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
            void redis.quit((_err, result) => {
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
            void redis.quit((_err, result) => {
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

    amqpConnectionManager: asFunction(
      () => {
        return new AmqpConnectionManager(getAmqpConfig(), dependencies.logger)
      },
      {
        lifetime: Lifetime.SINGLETON,
        asyncInit: 'init',
        asyncDispose: 'close',
        asyncDisposePriority: 1,
        enabled: options.queuesEnabled !== false && options.queuesEnabled !== undefined,
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
      return (
        dependencies.app?.newrelicTransactionManager ??
        (new FakeNewrelicTransactionManager() as NewRelicTransactionManager)
      )
    }, SINGLETON_CONFIG),
    amplitude: asFunction(() => {
      return dependencies.app?.amplitude ?? new FakeAmplitude()
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
  logger: CommonLogger
  scheduler: ToadScheduler

  redis: Redis
  redisPublisher: Redis
  redisConsumer: Redis
  prisma: PrismaClient

  amqpConnectionManager: AmqpConnectionManager

  // vendor-specific dependencies
  newRelicBackgroundTransactionManager: NewRelicTransactionManager
  amplitude: Amplitude

  errorReporter: ErrorReporter
  consumerErrorResolver: ErrorResolver

  fakeStoreApiClient: FakeStoreApiClient
}
