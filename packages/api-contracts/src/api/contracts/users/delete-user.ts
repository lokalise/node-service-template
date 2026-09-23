import { defineApiContract, noBodyResponse } from '@lokalise/api-contracts'
import z from 'zod/v4'
import { AUTH_HEADERS } from '../common.ts'

// DELETE /users/:userId
const DELETE_USER_REQUEST_PARAMS_SCHEMA = z.compile(
  z.object({
    userId: z.string(),
  }),
)
export type DeleteUserRequestParams = z.infer<typeof DELETE_USER_REQUEST_PARAMS_SCHEMA>

export const deleteUserContract = defineApiContract({
  method: 'delete',
  summary: 'Delete user',
  visibility: 'public',
  requestPathParamsSchema: DELETE_USER_REQUEST_PARAMS_SCHEMA,
  requestHeaderSchema: AUTH_HEADERS,
  pathResolver: (params) => `/users/${params.userId}`,
  responsesByStatusCode: {
    204: noBodyResponse(),
  },
})
