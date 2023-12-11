import z from 'zod'

export const PERMISSIONS_ADD_MESSAGE_SCHEMA = z.object({
  id: z.string(),
  messageType: z.literal('add'),
  userIds: z.array(z.number()).describe('User IDs'),
  permissions: z.array(z.string()).nonempty().describe('List of user permissions'),
})

export const PERMISSIONS_REMOVE_MESSAGE_SCHEMA = z.object({
  id: z.string(),
  messageType: z.literal('remove'),
  userIds: z.array(z.number()).describe('User IDs'),
  permissions: z.array(z.string()).nonempty().describe('List of user permissions'),
})

export type PERMISSIONS_ADD_MESSAGE_TYPE = z.infer<typeof PERMISSIONS_ADD_MESSAGE_SCHEMA>
export type PERMISSIONS_REMOVE_MESSAGE_TYPE = z.infer<typeof PERMISSIONS_REMOVE_MESSAGE_SCHEMA>
