import { defineApiContract } from '@lokalise/api-contracts'
import { toNumberPreprocessor } from '@lokalise/zod-extras'
import z from 'zod/v4'
import { USER_SCHEMA } from '../../objects/index.ts'
import { AUTH_HEADERS } from '../common.ts'

// POST /users
const CREATE_USER_REQUEST_BODY_SCHEMA = z.compile(
  z.object({
    name: z.string(),
    age: z.optional(z.nullable(z.preprocess(toNumberPreprocessor, z.number()))),
    email: z.email(),
    password: z.string(),
  }),
)
export type CreateUserRequestBody = z.infer<typeof CREATE_USER_REQUEST_BODY_SCHEMA>

const CREATE_USER_RESPONSE_BODY_SCHEMA = z.compile(
  z.object({
    data: USER_SCHEMA,
  }),
)
export type CreateUserResponseBody = z.infer<typeof CREATE_USER_RESPONSE_BODY_SCHEMA>

export const postCreateUserContract = defineApiContract({
  method: 'post',
  summary: 'Create user',
  visibility: 'public',
  requestHeaderSchema: AUTH_HEADERS,
  requestBodySchema: CREATE_USER_REQUEST_BODY_SCHEMA,
  pathResolver: () => '/users',
  responsesByStatusCode: {
    201: CREATE_USER_RESPONSE_BODY_SCHEMA,
  },
})
