import z from 'zod/v4'

export const USER_SCHEMA = z.compile(
  z.object({
    id: z.string().describe('Unique identifier of the user'),
    name: z.string().describe('Display name of the user'),
    age: z.number().nullable().describe('Age of the user in years, if known'),
    email: z.email().describe('Email address of the user'),
    internalNote: z
      .string()
      .meta({ visibility: 'internal' })
      .optional()
      .describe('Internal-only note about the user; never exposed on the public API'),
  }),
)
export type User = z.infer<typeof USER_SCHEMA>

z.globalRegistry.add(USER_SCHEMA, {
  id: 'User',
  description:
    'A user of the service, identified by a unique id and addressable by email. ' +
    'Exposed on the public API without internal-only fields such as the internal note.',
})
