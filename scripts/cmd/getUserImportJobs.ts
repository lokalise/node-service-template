import type { RequestContext } from '@lokalise/fastify-extras'
import z from 'zod'
import type { Dependencies } from '../../src/infrastructure/parentDiConfig.js'
import { cliCommandWrapper } from '../utils/cliCommandWrapper.js'

const origin = 'getUserImportJobsCommand'
const ARGUMENTS_SCHEMA = z.object({
  queue: z.enum(['active', 'failed', 'delayed', 'completed', 'waiting', 'prioritized']),
})
type Arguments = z.infer<typeof ARGUMENTS_SCHEMA>

const command = async (deps: Dependencies, reqContext: RequestContext, args: Arguments) => {
  const userImportJob = deps.userImportJob

  const jobs = await userImportJob.getJobsInQueue([args.queue])
  reqContext.logger.info(jobs, `${args.queue} jobs`)
}

void cliCommandWrapper(origin, command, ARGUMENTS_SCHEMA)
