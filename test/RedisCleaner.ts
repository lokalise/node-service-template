import type Redis from 'ioredis'

export async function cleanRedis(redis: Redis) {
  await redis.flushall('SYNC')
}
