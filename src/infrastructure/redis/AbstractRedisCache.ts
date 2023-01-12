import type Redis from 'ioredis'

export const EMPTY_VALUE = '$$lokalise_redis_null$$'

export abstract class AbstractRedisCache<SetEntity, GetEntity = SetEntity> {
  protected constructor(protected readonly redis: Redis, protected readonly keyPrefix: string) {}

  abstract get(key: string): Promise<GetEntity | null | undefined>

  abstract set(key: string, value: SetEntity | null, expirationTimeInSeconds: number): Promise<void>

  protected async setInternal(key: string, value: string | null, expirationTimeInSeconds: number) {
    const valueAsString = value ? value : EMPTY_VALUE

    await this.redis.set(this.resolveFullKey(key), valueAsString, 'EX', expirationTimeInSeconds)
  }

  /**
   * Returns undefined for cache misses and null for values explicitly cached as null
   */
  protected async getInternal(key: string): Promise<string | null | undefined> {
    const resultAsString = await this.redis.get(this.resolveFullKey(key))
    // Cache miss
    if (!resultAsString) {
      return undefined
    }

    // Cache hit, but value is explicitly null
    if (resultAsString === EMPTY_VALUE) {
      return null
    }

    // Cache hit, value is set
    return resultAsString
  }

  async del(key: string): Promise<boolean> {
    const result = await this.redis.del(this.resolveFullKey(key))
    return result === 1
  }

  async delMultiple(keys: string[]): Promise<number> {
    return await this.redis.del(keys.map((key) => this.resolveFullKey(key)))
  }

  async exists(key: string): Promise<boolean> {
    const result = await this.redis.exists(this.resolveFullKey(key))
    return result === 1
  }

  private resolveFullKey(key: string) {
    return `${this.keyPrefix}:${key}`
  }
}
