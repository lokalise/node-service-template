import { toNumberPreprocessor } from '@lokalise/zod-extras'
import z from 'zod'

export const CREATE_USER_SCHEMA = z.object({
  name: z.string(),
  age: z.optional(z.preprocess(toNumberPreprocessor, z.number())),
  email: z.string().email(),
})

export const GET_USER_SCHEMA = z.object({
  userId: z.preprocess(toNumberPreprocessor, z.number()),
})

export const GET_USER_SCHEMA_RESPONSE_SCHEMA = z.object({
  data: z.object({
    id: z.number(),
    name: z.string(),
    age: z.optional(z.preprocess(toNumberPreprocessor, z.number())),
    email: z.string().email(),
  }),
})

export type CREATE_USER_SCHEMA_TYPE = z.infer<typeof CREATE_USER_SCHEMA>
export type GET_USER_SCHEMA_TYPE = z.infer<typeof GET_USER_SCHEMA>
export type GET_USER_SCHEMA_RESPONSE_SCHEMA_TYPE = z.infer<typeof GET_USER_SCHEMA_RESPONSE_SCHEMA>
