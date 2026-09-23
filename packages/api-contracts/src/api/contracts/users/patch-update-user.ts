import { defineApiContract, noBodyResponse } from '@lokalise/api-contracts'
import z from 'zod/v4'
import { OpenApiTags } from '../../open-api-tags.ts'
import { AUTH_HEADERS } from '../common.ts'

// PATCH /users/:userId
const UPDATE_USER_REQUEST_BODY_SCHEMA = z.compile(
  z.object({
    name: z.optional(z.string()).describe('New display name for the user'),
    email: z.optional(z.email()).describe('New email address for the user'),
  }),
)
export type UpdateUserRequestBody = z.infer<typeof UPDATE_USER_REQUEST_BODY_SCHEMA>

const UPDATE_USER_REQUEST_PARAMS_SCHEMA = z.compile(
  z.object({
    userId: z.string().describe('Unique identifier of the user to update'),
  }),
)
export type UpdateUserRequestParams = z.infer<typeof UPDATE_USER_REQUEST_PARAMS_SCHEMA>

export const patchUpdateUserContract = defineApiContract({
  method: 'patch',
  summary: 'Update user',
  description: 'Update mutable fields of an existing user.',
  tags: [OpenApiTags.User.name],
  visibility: 'public',
  requestBodySchema: UPDATE_USER_REQUEST_BODY_SCHEMA,
  requestPathParamsSchema: UPDATE_USER_REQUEST_PARAMS_SCHEMA,
  requestHeaderSchema: AUTH_HEADERS,
  pathResolver: (params) => `/users/${params.userId}`,
  responsesByStatusCode: {
    204: noBodyResponse(),
  },
})
