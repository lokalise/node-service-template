import {
  createNotificationPair,
  type InMemoryCacheConfiguration,
  Loader,
  RedisCache,
} from 'layered-loader'
import type { User } from '../../db/schema/user.ts'
import { UserDataSource } from './datasources/UserDataSource.ts'
import type { UsersInjectableDependencies } from './UserModule.ts'

const IN_MEMORY_CACHE_TTL = 1000 * 60 * 5
const IN_MEMORY_TTL_BEFORE_REFRESH = 1000 * 25

const IN_MEMORY_CONFIGURATION_BASE: InMemoryCacheConfiguration = {
  ttlInMsecs: IN_MEMORY_CACHE_TTL,
  ttlLeftBeforeRefreshInMsecs: IN_MEMORY_TTL_BEFORE_REFRESH,
  cacheType: 'fifo-object',
}

export class UserLoader extends Loader<User> {
  constructor(deps: UsersInjectableDependencies) {
    const { publisher: notificationPublisher, consumer: notificationConsumer } =
      createNotificationPair<User>({
        channel: 'user-cache-notifications',
        consumerRedis: deps.redisConsumer,
        publisherRedis: deps.redisPublisher,
      })

    super({
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
    })
  }
}
