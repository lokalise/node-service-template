import type { RequestContext } from '@lokalise/fastify-extras'
import z from 'zod'
import type { Dependencies } from '../../src/infrastructure/CommonModule.ts'
import { cliCommandWrapper } from '../utils/cliCommandWrapper.ts'

const origin = 'getUserImportJobsCommand'
const ARGUMENTS_SCHEMA = z.object({
  queue: z.enum(['active', 'failed', 'delayed', 'completed', 'waiting', 'prioritized']),
})
type Arguments = z.infer<typeof ARGUMENTS_SCHEMA>

const command = async (deps: Dependencies, reqContext: RequestContext, args: Arguments) => {
  const queueManager = deps.bullmqQueueManager

  const jobs = await queueManager.getJobsInQueue('UserImportJob', [args.queue])
  reqContext.logger.info(jobs, `${args.queue} jobs`)
}

void cliCommandWrapper(origin, command, ARGUMENTS_SCHEMA)
