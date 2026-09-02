import { defineApiContract, noBodyResponse } from '@lokalise/api-contracts'
import { mergeErrorSchemasByStatusCode } from '@lokalise/errors'
import { USER_NOT_FOUND_ERROR_DEFINITION } from './userErrors.ts'
import {
  AUTH_HEADERS,
  CREATE_USER_BODY_SCHEMA,
  CREATE_USER_RESPONSE_BODY_SCHEMA,
  DELETE_USER_PARAMS_SCHEMA,
  GET_USER_PARAMS_SCHEMA,
  GET_USER_SCHEMA_RESPONSE_SCHEMA,
  GET_USERS_BY_IDS_BODY_SCHEMA,
  GET_USERS_BY_IDS_RESPONSE_SCHEMA,
  UPDATE_USER_BODY_SCHEMA,
  UPDATE_USER_PARAMS_SCHEMA,
} from './userSchemas.ts'

export const postCreateUserContract = defineApiContract({
  method: 'post',
  summary: 'Create user',
  visibility: 'public',
  requestHeaderSchema: AUTH_HEADERS,
  requestBodySchema: CREATE_USER_BODY_SCHEMA,
  pathResolver: () => '/users',
  responsesByStatusCode: {
    201: CREATE_USER_RESPONSE_BODY_SCHEMA,
  },
})

export const getUserContract = defineApiContract({
  method: 'get',
  summary: 'Get user',
  visibility: 'public',
  requestPathParamsSchema: GET_USER_PARAMS_SCHEMA,
  requestHeaderSchema: AUTH_HEADERS,
  pathResolver: (params) => `/users/${params.userId}`,
  responsesByStatusCode: {
    200: GET_USER_SCHEMA_RESPONSE_SCHEMA,
    ...mergeErrorSchemasByStatusCode([USER_NOT_FOUND_ERROR_DEFINITION]),
  },
})

export const deleteUserContract = defineApiContract({
  method: 'delete',
  summary: 'Delete user',
  visibility: 'public',
  requestPathParamsSchema: DELETE_USER_PARAMS_SCHEMA,
  requestHeaderSchema: AUTH_HEADERS,
  pathResolver: (params) => `/users/${params.userId}`,
  responsesByStatusCode: {
    204: noBodyResponse(),
  },
})

export const patchUpdateUserContract = defineApiContract({
  method: 'patch',
  summary: 'Update user',
  visibility: 'public',
  requestBodySchema: UPDATE_USER_BODY_SCHEMA,
  requestPathParamsSchema: UPDATE_USER_PARAMS_SCHEMA,
  requestHeaderSchema: AUTH_HEADERS,
  pathResolver: (params) => `/users/${params.userId}`,
  responsesByStatusCode: {
    204: noBodyResponse(),
  },
})

/**
 * Internal-only endpoint for service-to-service batch user lookups.
 *
 * Marked `visibility: 'internal'` so it is excluded from the public API surface
 * (public OpenAPI spec / gateway) while still being served by the app.
 */
export const postGetUsersByIdsContract = defineApiContract({
  method: 'post',
  summary: 'Batch-resolve users by their IDs (internal service-to-service lookup)',
  visibility: 'internal',
  requestHeaderSchema: AUTH_HEADERS,
  requestBodySchema: GET_USERS_BY_IDS_BODY_SCHEMA,
  pathResolver: () => '/internal/users/get-by-ids',
  responsesByStatusCode: {
    200: GET_USERS_BY_IDS_RESPONSE_SCHEMA,
  },
})
