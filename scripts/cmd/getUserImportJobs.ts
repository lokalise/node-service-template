import z from 'zod'
import { createCliContext, destroyCliContext } from '../utils/cliContextUtils.js'

const origin = 'getUserImportJobsCommand'
const ARGUMENTS_SCHEMA = z.object({
    queue: z.enum(['active', 'failed', 'delayed', 'completed', 'waiting', 'prioritized']),
})
type Arguments = z.infer<typeof ARGUMENTS_SCHEMA>

async function run() {
    const { app, logger, args } = await createCliContext<Arguments>(ARGUMENTS_SCHEMA, origin)
    const userImportJob = app.diContainer.cradle.userImportJob

    const jobs = await userImportJob.getJobsInQueue([args.queue])
    logger.info(jobs, `${args.queue} jobs`)

    await destroyCliContext(app)
}

void run()
