import { defineApiContract, noBodyResponse } from '@lokalise/api-contracts'
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

export const postCreateUserContract = defineApiContract({
  method: 'post',
  summary: 'Create user',
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
  requestPathParamsSchema: GET_USER_PARAMS_SCHEMA,
  requestHeaderSchema: AUTH_HEADERS,
  pathResolver: (params) => `/users/${params.userId}`,
  responsesByStatusCode: {
    200: GET_USER_SCHEMA_RESPONSE_SCHEMA,
  },
})

export const deleteUserContract = defineApiContract({
  method: 'delete',
  summary: 'Delete user',
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
  requestBodySchema: UPDATE_USER_BODY_SCHEMA,
  requestPathParamsSchema: UPDATE_USER_PARAMS_SCHEMA,
  requestHeaderSchema: AUTH_HEADERS,
  pathResolver: (params) => `/users/${params.userId}`,
  responsesByStatusCode: {
    204: noBodyResponse(),
  },
})
