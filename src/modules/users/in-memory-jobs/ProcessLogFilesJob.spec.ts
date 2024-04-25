import { cleanRedis } from '../../../../test/RedisCleaner'
import type { TestContext } from '../../../../test/TestContext'
import { createTestContext, destroyTestContext } from '../../../../test/TestContext'

describe('ProcessLogFilesJob', () => {
  let testContext: TestContext

  beforeAll(async () => {
    testContext = await createTestContext()
    await cleanRedis(testContext.diContainer.cradle.redis)
  })

  afterAll(async () => {
    await destroyTestContext(testContext)
  })

  it('smoke test', async () => {
    // this job doesn't really do anything, so we can't assert much
    expect.assertions(0)
    const { processLogFilesJob } = testContext.diContainer.cradle
    await processLogFilesJob.process()
  })
})
