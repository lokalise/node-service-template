import { defineApiContract, noBodyResponse } from '@lokalise/api-contracts'
import z from 'zod/v4'
import { AUTH_HEADERS } from '../common.ts'

// PATCH /users/:userId
const UPDATE_USER_REQUEST_BODY_SCHEMA = z.compile(
  z.object({
    name: z.optional(z.string()),
    email: z.optional(z.email()),
  }),
)
export type UpdateUserRequestBody = z.infer<typeof UPDATE_USER_REQUEST_BODY_SCHEMA>

const UPDATE_USER_REQUEST_PARAMS_SCHEMA = z.compile(
  z.object({
    userId: z.string(),
  }),
)
export type UpdateUserRequestParams = z.infer<typeof UPDATE_USER_REQUEST_PARAMS_SCHEMA>

export const patchUpdateUserContract = defineApiContract({
  method: 'patch',
  summary: 'Update user',
  visibility: 'public',
  requestBodySchema: UPDATE_USER_REQUEST_BODY_SCHEMA,
  requestPathParamsSchema: UPDATE_USER_REQUEST_PARAMS_SCHEMA,
  requestHeaderSchema: AUTH_HEADERS,
  pathResolver: (params) => `/users/${params.userId}`,
  responsesByStatusCode: {
    204: noBodyResponse(),
  },
})
