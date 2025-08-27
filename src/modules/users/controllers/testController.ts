import {
  buildFastifyPayloadRoute,
} from '@lokalise/fastify-api-contracts'
import { AbstractController, type BuildRoutesReturnType } from 'opinionated-machine'
import z from 'zod/v4'
import { buildPayloadRoute } from '@lokalise/api-contracts'

const RESPONSE_SCHEMA = z.object({
  //files: z.record(z.string(), z.string()), // this is working
  files: z.record(z.string(), z.record(z.string(), z.string())), // this is not working
})

export const TEST_CONTRACT = buildPayloadRoute({
  method: 'post',
  description: 'Request file upload form data for multiple files',
  requestBodySchema: z.object({}),
  pathResolver: () => `/poc_openAPI_issue/test`,
  successResponseBodySchema: RESPONSE_SCHEMA,
  responseSchemasByStatusCode: {
    200: RESPONSE_SCHEMA,
  },
})

type TestControllerContractsType = typeof TestController.contracts

export class TestController extends AbstractController<TestControllerContractsType> {
  public static contracts = {
    testContract: TEST_CONTRACT,
  } as const

  private test = buildFastifyPayloadRoute(TEST_CONTRACT, async (_, reply) => {
    return reply.status(200).send()
  })

  buildRoutes(): BuildRoutesReturnType<TestControllerContractsType> {
    return {
      testContract: this.test
    }
  }
}
