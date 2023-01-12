import type { User } from '@prisma/client'

import type { Dependencies } from '../../../infrastructure/diConfig'
import { AbstractRedisEntityCache } from '../../../infrastructure/redis/AbstractRedisEntityCache'

export class UserCache extends AbstractRedisEntityCache<User> {
  constructor({ redis }: Dependencies) {
    super(redis, 'user')
  }
}
