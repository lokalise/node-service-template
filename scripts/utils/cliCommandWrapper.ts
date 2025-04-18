import { parseArgs } from 'node:util'
import type { RequestContext } from '@lokalise/fastify-extras'
import { generateMonotonicUuid } from '@lokalise/id-utils'
import { isError } from '@lokalise/universal-ts-utils/node'
import { ENABLE_ALL } from 'opinionated-machine'
import pino from 'pino'
import type z from 'zod'
import { getApp } from '../../src/app.ts'
import type { Dependencies } from '../../src/infrastructure/CommonModule.ts'

const getArgs = () => {
  const { values } = parseArgs({
    args: process.argv,
    strict: false,
  })

  return values
}

export type CliCommand<
  ArgsSchema extends z.Schema | undefined,
  Args = ArgsSchema extends z.Schema ? z.infer<ArgsSchema> : undefined,
> = (dependencies: Dependencies, requestContext: RequestContext, args: Args) => Promise<void> | void

export const cliCommandWrapper = async <ArgsSchema extends z.Schema | undefined>(
  cliCommandName: string,
  command: CliCommand<ArgsSchema>,
  argsSchema?: ArgsSchema,
): Promise<void> => {
  const app = await getApp({
    healthchecksEnabled: false,
    monitoringEnabled: false,
    periodicJobsEnabled: false,
    messageQueueConsumersEnabled: false,
    enqueuedJobWorkersEnabled: false,
    jobQueuesEnabled: ENABLE_ALL,
  })

  const requestId = generateMonotonicUuid()
  const reqContext: RequestContext = {
    reqId: requestId,
    logger: app.diContainer.cradle.logger.child({
      origin: cliCommandName,
      'x-request-id': requestId,
    }),
  }

  let args = undefined
  if (argsSchema) {
    const parseResult = argsSchema.safeParse(getArgs())
    if (!parseResult.success) {
      reqContext.logger.error(
        {
          errors: JSON.stringify(parseResult.error.errors),
        },
        'Invalid arguments',
      )
      await app.close()
      process.exit(1)
    }

    args = parseResult.data
  }

  let isSuccess = true
  try {
    await command(app.diContainer.cradle, reqContext, args)
  } catch (err) {
    isSuccess = false
    reqContext.logger.error(
      {
        error: JSON.stringify(isError(err) ? pino.stdSerializers.err(err) : err),
      },
      'Error running command',
    )
  }

  await app.close()
  process.exit(isSuccess ? 0 : 1)
}
