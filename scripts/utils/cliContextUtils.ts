import { type ParseArgsConfig, parseArgs } from 'node:util'
import type { RequestContext } from '@lokalise/fastify-extras'
import { generateMonotonicUuid } from '@lokalise/id-utils'
import type { CommonLogger } from '@lokalise/node-core'
import type z from 'zod'
import { type AppInstance, getApp } from '../../src/app.js'

export const getArgs = (config: Partial<ParseArgsConfig> = {}) => {
  const { values } = parseArgs({
    ...config,
    args: process.argv,
    strict: false,
  } satisfies ParseArgsConfig)

  return values
}

export const createCliContext = async <Arguments>(
  // biome-ignore lint/suspicious/noExplicitAny: This is a generic schema
  ARGUMENTS_SCHEMA: z.ZodObject<any>,
  origin: string,
): Promise<{
  app: AppInstance
  logger: CommonLogger
  args: Arguments
}> => {
  const app = await getApp({
    queuesEnabled: false,
    jobsEnabled: false,
    healthchecksEnabled: false,
    monitoringEnabled: false,
  })

  const requestId = generateMonotonicUuid()
  const reqContext: RequestContext = {
    reqId: requestId,
    logger: (app.diContainer.cradle.logger as CommonLogger).child({
      origin,
      'x-request-id': requestId,
    }),
  }

  const res = ARGUMENTS_SCHEMA.safeParse(getArgs())
  if (!res.success) {
    reqContext.logger.error(res.error.errors, 'Invalid arguments')
    await app.close()
    process.exit(1)
  }
  const args = res.data as Arguments

  return { app, logger: reqContext.logger, args }
}

export const destroyCliContext = async (app: AppInstance, failure = false) => {
  await app.close()
  process.exit(failure ? 1 : 0)
}
