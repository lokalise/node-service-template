import type { Dependencies } from '../../../infrastructure/diConfig'
import { AbstractRedisConfigStore } from '../../../infrastructure/redis/AbstractRedisConfigStore'

export class ConfigStore extends AbstractRedisConfigStore {
  constructor({ redis }: Dependencies) {
    super(redis, 'config')
  }
}
