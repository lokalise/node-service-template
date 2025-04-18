import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { DB_MODEL, cleanTables } from '../../../../test/DbCleaner.ts'
import { cleanRedis } from '../../../../test/RedisCleaner.ts'
import { type TestContext, testContextFactory } from '../../../../test/TestContext.ts'

import type { QueueManager } from '@lokalise/background-jobs-common'
import { user as userTable } from '../../../db/schema/user.ts'
import type { BullmqSupportedQueues } from '../../../infrastructure/CommonModule.ts'
import { UserImportJob } from './UserImportJob.ts'

describe('UserImportJob', () => {
  let testContext: TestContext

  let userImportJob: UserImportJob
  let bullmqQueueManager: QueueManager<BullmqSupportedQueues>

  beforeAll(async () => {
    testContext = await testContextFactory.createTestContext({
      diOptions: {
        enqueuedJobWorkersEnabled: [UserImportJob.QUEUE_ID],
        jobQueuesEnabled: [UserImportJob.QUEUE_ID],
      },
    })

    await cleanRedis(testContext.diContainer.cradle.redis)
    await cleanTables(testContext.diContainer.cradle.drizzle, [DB_MODEL.User])
    userImportJob = testContext.diContainer.cradle.userImportJob
    bullmqQueueManager = testContext.diContainer.cradle.bullmqQueueManager
  })

  afterAll(async () => {
    await testContext.destroy()
  })

  it('creates a user', async () => {
    const userData = {
      name: 'name',
      age: 33,
      email: 'test@email.lt',
    }

    const jobId = await bullmqQueueManager.schedule('UserImportJob', {
      ...userData,
      metadata: { correlationId: 'dummy' },
    })
    const result = await userImportJob.spy.waitForJobWithId(jobId, 'completed')

    const users = await testContext.diContainer.cradle.drizzle.select().from(userTable)
    expect(users).toHaveLength(1)
    expect(users[0]).toMatchObject(userData)

    expect(result.attemptsMade).toBe(1)
  })
})
