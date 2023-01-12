import { AbstractRedisCache } from './AbstractRedisCache'

export abstract class AbstractRedisStringCache extends AbstractRedisCache<string> {
  async set(key: string, value: string | null, expirationTimeInSeconds: number) {
    await this.setInternal(key, value, expirationTimeInSeconds)
  }

  /**
   * Returns undefined for cache misses and null for values explicitly cached as null
   */
  async get(key: string): Promise<string | null | undefined> {
    return await this.getInternal(key)
  }
}
