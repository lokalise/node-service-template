import { toNumberPreprocessor } from '@lokalise/zod-extras'
import z from 'zod'

export const CREATE_USER_SCHEMA = z.object({
  name: z.string(),
  age: z.optional(z.preprocess(toNumberPreprocessor, z.number())),
  email: z.string().email(),
})

export type CREATE_USER_SCHEMA_TYPE = z.infer<typeof CREATE_USER_SCHEMA>
