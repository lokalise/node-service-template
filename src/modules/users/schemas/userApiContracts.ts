import { buildRestContract } from '@lokalise/api-contracts'
import z from 'zod/v4'
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

export const postCreateUserContract = buildRestContract({
  method: 'post', // can also be 'patch' or 'post'
  successResponseBodySchema: CREATE_USER_RESPONSE_BODY_SCHEMA,
  requestHeaderSchema: AUTH_HEADERS,
  requestBodySchema: CREATE_USER_BODY_SCHEMA,
  pathResolver: () => '/users',
  description: 'Create user',
})

export const getUserContract = buildRestContract({
  method: 'get',
  successResponseBodySchema: GET_USER_SCHEMA_RESPONSE_SCHEMA,
  requestPathParamsSchema: GET_USER_PARAMS_SCHEMA,
  requestHeaderSchema: AUTH_HEADERS,
  pathResolver: (params) => `/users/${params.userId}`,
  description: 'Get user',
})

export const deleteUserContract = buildRestContract({
  method: 'delete',
  successResponseBodySchema: z.undefined(),
  requestPathParamsSchema: DELETE_USER_PARAMS_SCHEMA,
  requestHeaderSchema: AUTH_HEADERS,
  pathResolver: (params) => `/users/${params.userId}`,
  description: 'Delete user',
})

export const patchUpdateUserContract = buildRestContract({
  method: 'patch', // can also be 'patch' or 'post'
  successResponseBodySchema: z.undefined(),
  isEmptyResponseExpected: true,
  requestBodySchema: UPDATE_USER_BODY_SCHEMA,
  requestPathParamsSchema: UPDATE_USER_PARAMS_SCHEMA,
  requestHeaderSchema: AUTH_HEADERS,
  pathResolver: (params) => `/users/${params.userId}`,
  description: 'Update user',
})
