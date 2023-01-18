import z from 'zod'

export const PERMISSIONS_MESSAGE_SCHEMA = z.object({
  userIds: z.array(z.number()).describe('User IDs'),
  permissions: z.array(z.string()).nonempty().describe('List of user permissions'),
  operation: z.enum(['add', 'remove']),
})

export type PERMISSIONS_MESSAGE_TYPE = z.infer<typeof PERMISSIONS_MESSAGE_SCHEMA>
