import { buildDeleteRoute, buildGetRoute, buildPayloadRoute } from '@lokalise/api-contracts'
import z from 'zod'
import {
  AUTH_HEADERS,
  CREATE_USER_BODY_SCHEMA,
  CREATE_USER_RESPONSE_BODY_SCHEMA,
  DELETE_USER_PARAMS_SCHEMA,
  GET_USER_PARAMS_SCHEMA,
  GET_USER_SCHEMA_RESPONSE_SCHEMA,
  UPDATE_USER_BODY_SCHEMA,
  UPDATE_USER_PARAMS_SCHEMA,
} from './userSchemas.ts'

export const postCreateUserContract = buildPayloadRoute({
  method: 'post', // can also be 'patch' or 'post'
  successResponseBodySchema: CREATE_USER_RESPONSE_BODY_SCHEMA,
  requestHeaderSchema: AUTH_HEADERS,
  requestBodySchema: CREATE_USER_BODY_SCHEMA,
  pathResolver: () => '/users',
  description: 'Create user',
})

export const getUserContract = buildGetRoute({
  successResponseBodySchema: GET_USER_SCHEMA_RESPONSE_SCHEMA,
  requestPathParamsSchema: GET_USER_PARAMS_SCHEMA,
  requestHeaderSchema: AUTH_HEADERS,
  pathResolver: (params) => `/users/${params.userId}`,
  description: 'Get user',
})

export const deleteUserContract = buildDeleteRoute({
  successResponseBodySchema: z.undefined(),
  requestPathParamsSchema: DELETE_USER_PARAMS_SCHEMA,
  requestHeaderSchema: AUTH_HEADERS,
  pathResolver: (params) => `/users/${params.userId}`,
  description: 'Delete user',
})

export const patchUpdateUserContract = buildPayloadRoute({
  method: 'patch', // can also be 'patch' or 'post'
  successResponseBodySchema: z.undefined(),
  isEmptyResponseExpected: true,
  requestBodySchema: UPDATE_USER_BODY_SCHEMA,
  requestPathParamsSchema: UPDATE_USER_PARAMS_SCHEMA,
  requestHeaderSchema: AUTH_HEADERS,
  pathResolver: (params) => `/users/${params.userId}`,
  description: 'Update user',
})
