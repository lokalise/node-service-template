import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { cleanRedis } from '../../../../test/RedisCleaner.ts'
import { type TestContext, testContextFactory } from '../../../../test/TestContext.ts'

describe('DeleteOldUsersJob', () => {
  let testContext: TestContext

  beforeAll(async () => {
    testContext = await testContextFactory.createTestContext()
    await cleanRedis(testContext.diContainer.cradle.redis)
  })

  afterAll(async () => {
    await testContext.destroy()
  })

  it('smoke test', async () => {
    // this job doesn't really do anything, so we can't assert much
    expect.assertions(0)
    const { deleteOldUsersJob } = testContext.diContainer.cradle
    await deleteOldUsersJob.process(randomUUID())
    deleteOldUsersJob.register()
    await deleteOldUsersJob.dispose()
  })
})
