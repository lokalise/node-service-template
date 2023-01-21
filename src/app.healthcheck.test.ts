import type { Redis } from 'ioredis'

import { testRedisHealth } from './infrastructure/healthchecks'

const createRedisMock = (pingLatency: number, response = 'PONG') =>
  ({
    ping: () => new Promise((resolve) => setTimeout(resolve, pingLatency, response)),
  } as jest.Mocked<Redis>)

describe('healthchecks', () => {
  it('Fails fast when Redis is not available', async () => {
    expect.assertions(1)
    jest.useFakeTimers()

    const promise = testRedisHealth(createRedisMock(999999))

    jest.advanceTimersByTime(10000)

    await expect(promise).rejects.toThrow('Redis connection timed out')

    jest.useRealTimers()
  })

  it('Fails on unexpected Redis response', async () => {
    expect.assertions(1)
    jest.useFakeTimers()

    const response = ''
    const promise = testRedisHealth(createRedisMock(0, response))

    jest.advanceTimersByTime(10000)

    await expect(promise).rejects.toThrow('Redis did not respond with PONG')

    jest.useRealTimers()
  })

  it('Does not fail on successful Redis ping', async () => {
    expect.assertions(1)
    jest.useFakeTimers()

    const promise = testRedisHealth(createRedisMock(0))

    jest.advanceTimersByTime(10000)

    await expect(promise).resolves.not.toThrow()

    jest.useRealTimers()
  })
})
