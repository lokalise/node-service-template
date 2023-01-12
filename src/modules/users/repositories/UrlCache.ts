import type { Dependencies } from '../../../infrastructure/diConfig'
import { AbstractRedisStringCache } from '../../../infrastructure/redis/AbstractRedisStringCache'

export class UrlCache extends AbstractRedisStringCache {
  constructor({ redis }: Dependencies) {
    super(redis, 'url')
  }
}
