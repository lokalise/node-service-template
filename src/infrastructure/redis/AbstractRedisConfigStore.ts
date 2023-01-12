import { AbstractRedisCache } from './AbstractRedisCache'

export type ConfigValue = string | Date | number | boolean | bigint | Record<string, unknown> | null

export abstract class AbstractRedisConfigStore extends AbstractRedisCache<ConfigValue, string> {
  async set(key: string, value: ConfigValue, expirationTimeInSeconds: number) {
    const resolvedValue = convertToOptionalString(value)
    await this.setInternal(key, resolvedValue, expirationTimeInSeconds)
  }

  /**
   * Returns undefined for cache misses and null for values explicitly cached as null
   */
  async get(key: string): Promise<string | null | undefined> {
    return await this.getInternal(key)
  }

  async getBoolean(key: string): Promise<boolean | null | undefined> {
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
    return resultAsString.toLowerCase() === 'true'
  }

  async getInteger(key: string): Promise<number | null | undefined> {
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
    return Number.parseInt(resultAsString)
  }

  async getObject(key: string): Promise<Record<string, unknown> | null | undefined> {
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

function convertToOptionalString(value: unknown): string | null {
  if (value === undefined || value === null) {
    return null
  }

  if (typeof value === 'string') {
    return value
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return value.toString()
  }
  if (typeof value === 'object') {
    if (value instanceof Date) {
      return value.toISOString()
    }
    return JSON.stringify(value)
  }
  if (typeof value === 'bigint') {
    return value.toString()
  }

  throw new Error(`Unsupported config store value: ${JSON.stringify(value)}`)
}
