import { toNumberPreprocessor } from '@lokalise/zod-extras'
import z from 'zod'

export const CREATE_USER_BODY_SCHEMA = z.object({
  name: z.string(),
  age: z.optional(z.nullable(z.preprocess(toNumberPreprocessor, z.number()))),
  email: z.string().email(),
})

export const UPDATE_USER_BODY_SCHEMA = z.object({
  name: z.optional(z.string()),
  email: z.optional(z.string().email()),
})

export const GET_USER_PARAMS_SCHEMA = z.object({
  userId: z.string(),
})

export const UPDATE_USER_PARAMS_SCHEMA = z.object({
  userId: z.string(),
})

export const DELETE_USER_PARAMS_SCHEMA = z.object({
  userId: z.string(),
})

export const USER_SCHEMA = z.object({
  id: z.string(),
  name: z.string(),
  age: z.optional(z.nullable(z.preprocess(toNumberPreprocessor, z.number()))),
  email: z.string().email(),
})

export const GET_USER_SCHEMA_RESPONSE_SCHEMA = z.object({
  data: USER_SCHEMA,
})

export type USER_SCHEMA_TYPE = z.infer<typeof USER_SCHEMA>

export type CREATE_USER_BODY_SCHEMA_TYPE = z.infer<typeof CREATE_USER_BODY_SCHEMA>
export type UPDATE_USER_BODY_SCHEMA_TYPE = z.infer<typeof UPDATE_USER_BODY_SCHEMA>

export type GET_USER_PARAMS_SCHEMA_TYPE = z.infer<typeof GET_USER_PARAMS_SCHEMA>
export type UPDATE_USER_PARAMS_SCHEMA_TYPE = z.infer<typeof UPDATE_USER_PARAMS_SCHEMA>
export type DELETE_USER_PARAMS_SCHEMA_TYPE = z.infer<typeof DELETE_USER_PARAMS_SCHEMA>
export type GET_USER_SCHEMA_RESPONSE_SCHEMA_TYPE = z.infer<typeof GET_USER_SCHEMA_RESPONSE_SCHEMA>
