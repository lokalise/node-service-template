import { defineApiContract } from '@lokalise/api-contracts'
import { mergeErrorSchemasByStatusCode } from '@lokalise/errors'
import z from 'zod/v4'
import { USER_NOT_FOUND_ERROR_DEFINITION } from '../../errors/userErrors.ts'
import { USER_SCHEMA } from '../../objects/index.ts'
import { AUTH_HEADERS } from '../common.ts'

// GET /users/:userId
const GET_USER_REQUEST_PARAMS_SCHEMA = z.compile(
  z.object({
    userId: z.string(),
  }),
)
export type GetUserRequestParams = z.infer<typeof GET_USER_REQUEST_PARAMS_SCHEMA>

const GET_USER_RESPONSE_BODY_SCHEMA = z.compile(
  z.object({
    data: USER_SCHEMA,
  }),
)
export type GetUserResponseBody = z.infer<typeof GET_USER_RESPONSE_BODY_SCHEMA>

export const getUserContract = defineApiContract({
  method: 'get',
  summary: 'Get user',
  visibility: 'public',
  requestPathParamsSchema: GET_USER_REQUEST_PARAMS_SCHEMA,
  requestHeaderSchema: AUTH_HEADERS,
  pathResolver: (params) => `/users/${params.userId}`,
  responsesByStatusCode: {
    200: GET_USER_RESPONSE_BODY_SCHEMA,
    ...mergeErrorSchemasByStatusCode([USER_NOT_FOUND_ERROR_DEFINITION]),
  },
})
