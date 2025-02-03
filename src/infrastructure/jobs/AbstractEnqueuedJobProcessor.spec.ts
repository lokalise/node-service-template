import type { BaseJobPayload } from '@lokalise/background-jobs-common'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { cleanRedis } from '../../../test/RedisCleaner.js'
import {
  type TestContext,
  createTestContext,
  destroyTestContext,
} from '../../../test/TestContext.js'
import { AbstractEnqueuedJobProcessor } from './AbstractEnqueuedJobProcessor.js'

const TEST_QUEUE = 'dummy_queue'

class TestJobProcessor extends AbstractEnqueuedJobProcessor<BaseJobPayload> {
  protected async execute() {
    // Mock implementation
  }

  protected async process() {
    // Mock implementation
  }
}

describe('AbstractEnqueuedJobProcessor', () => {
  let testContext: TestContext

  describe('Default mode', () => {
    beforeAll(async () => {
      testContext = await createTestContext()
    })

    beforeEach(async () => {
      await cleanRedis(testContext.diContainer.cradle.redis)
    })

    afterAll(async () => {
      await destroyTestContext(testContext)
    })

    it('should start queue and worker', async () => {
      // @ts-ignore using protected constructor for testing purposes
      const processor = new TestJobProcessor(testContext.diContainer.cradle, {
        queueId: TEST_QUEUE,
        queueOptions: {},
        workerOptions: {},
      })
      await processor.start()

      // Worker is instantiated and running
      expect(processor.worker.isRunning()).toBeTruthy()

      const jobData = {
        id: 'test_id',
        value: 'test',
        metadata: { correlationId: 'correlation_id' },
      }
      const jobId = await processor.schedule(jobData)

      // Job is added to the queue and processed by the worker
      const spyResult = await processor.spy.waitForJobWithId(jobId, 'completed')
      expect(spyResult.data).toMatchObject(jobData)

      await processor.dispose()
    })
  })

  describe('CLI mode enabled', () => {
    beforeAll(async () => {
      testContext = await createTestContext(
        {},
        {},
        {
          app: {
            cliMode: true,
          },
        },
      )
    })

    beforeEach(async () => {
      await cleanRedis(testContext.diContainer.cradle.redis)
    })

    afterAll(async () => {
      await destroyTestContext(testContext)
    })

    it('should start queue but not worker', async () => {
      // @ts-ignore using protected constructor for testing purposes
      const processor = new TestJobProcessor(testContext.diContainer.cradle, {
        queueId: TEST_QUEUE,
        queueOptions: {},
        workerOptions: {},
      })
      await processor.start()

      // Worker is instantiated but not running
      expect(processor.worker.isRunning()).toBeFalsy()

      const jobData = {
        id: 'test_id',
        value: 'test',
        metadata: { correlationId: 'correlation_id' },
      }
      const jobId = await processor.schedule(jobData)

      // Job is added to the queue but not processed by the worker
      const spyResult = await processor.spy.waitForJobWithId(jobId, 'scheduled')
      expect(spyResult.data).toMatchObject(jobData)

      await processor.dispose()
    })
  })
})
