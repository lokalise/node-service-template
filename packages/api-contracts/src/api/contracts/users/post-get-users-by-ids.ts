import { defineApiContract } from '@lokalise/api-contracts'
import z from 'zod/v4'
import { USER_SCHEMA } from '../../objects/index.ts'
import { OpenApiTags } from '../../open-api-tags.ts'
import { AUTH_HEADERS } from '../common.ts'

// POST /internal/users/get-by-ids
const GET_USERS_BY_IDS_REQUEST_BODY_SCHEMA = z.compile(
  z.object({
    userIds: z.array(z.string()).min(1).describe('Non-empty list of user identifiers to resolve'),
  }),
)
export type GetUsersByIdsRequestBody = z.infer<typeof GET_USERS_BY_IDS_REQUEST_BODY_SCHEMA>

const GET_USERS_BY_IDS_RESPONSE_BODY_SCHEMA = z.compile(
  z.object({
    data: z.array(USER_SCHEMA),
  }),
)
export type GetUsersByIdsResponseBody = z.infer<typeof GET_USERS_BY_IDS_RESPONSE_BODY_SCHEMA>

/**
 * Internal-only endpoint for service-to-service batch user lookups.
 *
 * Marked `visibility: 'internal'` so it is excluded from the public API surface
 * (public OpenAPI spec / gateway) while still being served by the app.
 */
export const postGetUsersByIdsContract = defineApiContract({
  method: 'post',
  summary: 'Batch-resolve users by their IDs (internal service-to-service lookup)',
  description: 'Resolve multiple users by their identifiers in a single internal request.',
  tags: [OpenApiTags.User.name],
  visibility: 'internal',
  requestHeaderSchema: AUTH_HEADERS,
  requestBodySchema: GET_USERS_BY_IDS_REQUEST_BODY_SCHEMA,
  pathResolver: () => '/internal/users/get-by-ids',
  responsesByStatusCode: {
    200: GET_USERS_BY_IDS_RESPONSE_BODY_SCHEMA,
  },
})
