import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { DB_MODEL, cleanTables } from '../../../../test/DbCleaner.js'
import { cleanRedis } from '../../../../test/RedisCleaner.js'
import type { TestContext } from '../../../../test/TestContext.js'
import { createTestContext, destroyTestContext } from '../../../../test/TestContext.js'

import { UserImportJob } from './UserImportJob.js'

describe('UserImportJob', () => {
  let testContext: TestContext

  let userImportJob: UserImportJob
  beforeAll(async () => {
    testContext = await createTestContext(
      {},
      {
        jobsEnabled: [UserImportJob.QUEUE_ID],
      },
    )
    await cleanRedis(testContext.diContainer.cradle.redis)
    await cleanTables(testContext.diContainer.cradle.prisma, [DB_MODEL.User])
    userImportJob = testContext.diContainer.cradle.userImportJob
  })

  afterAll(async () => {
    await destroyTestContext(testContext)
  })

  it('creates a user', async () => {
    const userData = {
      name: 'name',
      age: 33,
      email: 'test@email.lt',
    }

    const jobId = await userImportJob.schedule({
      payload: userData,
      metadata: {
        correlationId: 'dummy',
      },
    })
    const result = await testContext.diContainer.cradle.userImportJob.spy.waitForJobWithId(
      jobId,
      'completed',
    )

    const users = await testContext.diContainer.cradle.prisma.user.findMany()
    expect(users).toHaveLength(1)
    expect(users[0]).toMatchObject(userData)

    expect(result.attemptsMade).toBe(1)
  })
})
