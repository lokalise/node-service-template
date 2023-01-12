import { AbstractRedisCache } from './AbstractRedisCache'

export const HOUR_IN_SECONDS = 3600

export abstract class AbstractRedisEntityCache<
  Entity extends Record<string, unknown>,
> extends AbstractRedisCache<Entity> {
  async set(key: string, value: Entity | null, expirationTimeInSeconds: number) {
    const valueAsString = value ? JSON.stringify(value) : null

    await this.setInternal(key, valueAsString, expirationTimeInSeconds)
  }

  /**
   * Returns undefined for cache misses and null for values explicitly cached as null
   */
  async get(key: string): Promise<Entity | null | undefined> {
    const resultAsString = await this.getInternal(key)
    // Cache miss
    if (resultAsString === undefined) {
      return undefined
    }

    // Cache hit, but value is explicitly null
    if (resultAsString === null) {
      return null
    }

    // Cache hit, value is set
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return JSON.parse(resultAsString)
  }
}
