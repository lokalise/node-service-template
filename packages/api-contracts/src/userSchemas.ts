import { toNumberPreprocessor } from '@lokalise/zod-extras'
import z from 'zod/v4'

// Every schema below goes through `z.compile()`: these are parsed on every request, so the
// AOT-compiled fast path is worth the one-off compilation at import time. Compilation is
// type-transparent (`compile<T>(schema): T`), so inference and JSON Schema generation are
// unaffected. Derive from the pre-compile schema, never from the compiled clone: `.extend()`
// and friends return an uncompiled schema.
export const USER_SCHEMA = z.compile(
  z.object({
    id: z.string(),
    name: z.string(),
    age: z.optional(z.nullable(z.preprocess(toNumberPreprocessor, z.number()))),
    email: z.email(),
  }),
)

export const CREATE_USER_BODY_SCHEMA = z.compile(
  z.object({
    name: z.string(),
    age: z.optional(z.nullable(z.preprocess(toNumberPreprocessor, z.number()))),
    email: z.email(),
  }),
)

export const CREATE_USER_RESPONSE_BODY_SCHEMA = z.compile(
  z.object({
    data: USER_SCHEMA,
  }),
)

export const UPDATE_USER_BODY_SCHEMA = z.compile(
  z.object({
    name: z.optional(z.string()),
    email: z.optional(z.email()),
  }),
)

export const GET_USER_PARAMS_SCHEMA = z.compile(
  z.object({
    userId: z.string(),
  }),
)

export const UPDATE_USER_PARAMS_SCHEMA = z.compile(
  z.object({
    userId: z.string(),
  }),
)

export const DELETE_USER_PARAMS_SCHEMA = z.compile(
  z.object({
    userId: z.string(),
  }),
)

export const GET_USER_SCHEMA_RESPONSE_SCHEMA = z.compile(
  z.object({
    data: USER_SCHEMA,
  }),
)

export const GET_USERS_BY_IDS_BODY_SCHEMA = z.compile(
  z.object({
    userIds: z.array(z.string()).min(1),
  }),
)

export const GET_USERS_BY_IDS_RESPONSE_SCHEMA = z.compile(
  z.object({
    data: z.array(USER_SCHEMA),
  }),
)

export type USER_SCHEMA_TYPE = z.infer<typeof USER_SCHEMA>

export const AUTH_HEADERS = z.compile(
  z.object({
    authorization: z.string(),
  }),
)
