import type { User } from '@prisma/client'
import type { Resolver } from 'awilix'
import { asClass, asFunction, Lifetime } from 'awilix'
import type { InMemoryCacheConfiguration, LoaderConfig } from 'layered-loader'
import { Loader, createNotificationPair, RedisCache } from 'layered-loader'

import type { Dependencies } from '../../infrastructure/diConfig'
import { SINGLETON_CONFIG } from '../../infrastructure/diConfig'

import { UserDataSource } from './datasources/UserDataSource'
import { UserRepository } from './repositories/UserRepository'
import { UserService } from './services/UserService'

const IN_MEMORY_CACHE_TTL = 1000 * 60 * 5
const IN_MEMORY_TTL_BEFORE_REFRESH = 1000 * 25

const IN_MEMORY_CONFIGURATION_BASE: InMemoryCacheConfiguration = {
  ttlInMsecs: IN_MEMORY_CACHE_TTL,
  ttlLeftBeforeRefreshInMsecs: IN_MEMORY_TTL_BEFORE_REFRESH,
  cacheType: 'fifo-object',
}

type UsersDiConfig = Record<keyof UsersDependencies, Resolver<unknown>>

export type UsersDependencies = {
  userRepository: UserRepository
  userService: UserService
  userLoader: Loader<User>
}

export const usersConfig: UsersDiConfig = {
  userRepository: asClass(UserRepository, SINGLETON_CONFIG),
  userService: asClass(UserService, SINGLETON_CONFIG),

  userLoader: asFunction(
    (deps: Dependencies) => {
      const { publisher: notificationPublisher, consumer: notificationConsumer } =
        createNotificationPair<User>({
          channel: 'user-cache-notifications',
          consumerRedis: deps.redisConsumer,
          publisherRedis: deps.redisPublisher,
        })

      const config: LoaderConfig<User> = {
        inMemoryCache: {
          ...IN_MEMORY_CONFIGURATION_BASE,
          maxItems: 1000,
        },
        asyncCache: new RedisCache<User>(deps.redis, {
          json: true,
          prefix: 'layered-loader:users:',
          ttlInMsecs: 1000 * 60 * 60,
        }),
        dataSources: [new UserDataSource(deps)],
        notificationConsumer,
        notificationPublisher,
        logger: deps.logger,
      }
      return new Loader(config)
    },
    {
      lifetime: Lifetime.SINGLETON,
    },
  ),
}

export type UsersPublicDependencies = Pick<UsersDependencies, 'userService'>
