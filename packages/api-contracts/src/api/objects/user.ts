import z from 'zod/v4'

export const USER_SCHEMA = z.compile(
  z.object({
    id: z.string(),
    name: z.string(),
    age: z.number().nullable(),
    email: z.email(),
    password: z.string().meta({ visibility: 'internal' }),
  }),
)
export type User = z.infer<typeof USER_SCHEMA>
