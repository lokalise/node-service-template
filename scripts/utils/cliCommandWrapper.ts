import { parseArgs } from 'node:util'
import type { RequestContext } from '@lokalise/fastify-extras'
import { generateMonotonicUuid } from '@lokalise/id-utils'
import { isError, stringValueSerializer } from '@lokalise/node-core'
import { ENABLE_ALL } from 'opinionated-machine'
import pino from 'pino'
import type z from 'zod/v4'
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

  let args = undefined as ArgsSchema extends z.Schema ? z.infer<ArgsSchema> : undefined
  if (argsSchema) {
    const parseResult = argsSchema.safeParse(getArgs())
    if (!parseResult.success) {
      reqContext.logger.error(
        {
          errors: JSON.stringify(parseResult.error.issues),
        },
        'Invalid arguments',
      )
      await app.close()
      process.exit(1)
    }

    args = parseResult.data as ArgsSchema extends z.Schema ? z.infer<ArgsSchema> : undefined
  }

  let isSuccess = true
  try {
    await command(app.diContainer.cradle, reqContext, args)
  } catch (err) {
    isSuccess = false
    reqContext.logger.error(
      {
        error: isError(err) ? pino.stdSerializers.err(err) : stringValueSerializer(err),
      },
      'Error running command',
    )
  }

  await app.close()
  process.exit(isSuccess ? 0 : 1)
}
