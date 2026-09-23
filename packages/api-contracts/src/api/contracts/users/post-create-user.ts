import { defineApiContract } from '@lokalise/api-contracts'
import { toNumberPreprocessor } from '@lokalise/zod-extras'
import z from 'zod/v4'
import { USER_SCHEMA } from '../../objects/index.ts'
import { OpenApiTags } from '../../open-api-tags.ts'
import { AUTH_HEADERS, INTERNAL_SERVER_ERROR_RESPONSE_SCHEMA } from '../common.ts'

// POST /users
const CREATE_USER_REQUEST_BODY_SCHEMA = z.compile(
  z.object({
    name: z.string().describe('Display name of the user'),
    age: z
      .optional(z.nullable(z.preprocess(toNumberPreprocessor, z.number())))
      .describe('Age of the user in years, if known'),
    email: z.email().describe('Email address of the user'),
    password: z.string().describe('Internal-only credential for the user'),
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
  description: 'Create a new user and return the created record.',
  tags: [OpenApiTags.User.name],
  visibility: 'public',
  requestHeaderSchema: AUTH_HEADERS,
  requestBodySchema: CREATE_USER_REQUEST_BODY_SCHEMA,
  pathResolver: () => '/users',
  responsesByStatusCode: {
    201: CREATE_USER_RESPONSE_BODY_SCHEMA,
    '5xx': INTERNAL_SERVER_ERROR_RESPONSE_SCHEMA,
  },
})
