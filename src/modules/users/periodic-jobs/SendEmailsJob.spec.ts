import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { cleanRedis } from '../../../../test/RedisCleaner.ts'
import { type TestContext, testContextFactory } from '../../../../test/TestContext.ts'

describe('SendEmailsJob', () => {
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
    const { sendEmailsJob } = testContext.diContainer.cradle
    await sendEmailsJob.process(randomUUID())
    sendEmailsJob.register()
    await sendEmailsJob.dispose()
  })
})
