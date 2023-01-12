import { cleanRedis } from '../../../../test/RedisCleaner'
import type { TestContext } from '../../../../test/TestContext'
import { createTestContext, destroyTestContext } from '../../../../test/TestContext'

describe('DeleteOldUsersJob', () => {
  let testContext: TestContext

  beforeAll(async () => {
    testContext = createTestContext()
    await cleanRedis(testContext.diContainer.cradle.redis)
  })

  afterAll(async () => {
    await destroyTestContext(testContext)
  })

  it('smoke test', async () => {
    // this job doesn't really do anything, so we can't assert much
    expect.assertions(0)
    const { deleteOldUsersJob } = testContext.diContainer.cradle
    await deleteOldUsersJob.process()
  })
})
