import { BASE_MESSAGE_SCHEMA } from '@message-queue-toolkit/core'
import z from 'zod'

export const PERMISSIONS_ADD_MESSAGE_SCHEMA = BASE_MESSAGE_SCHEMA.extend({
  type: z.literal('add'),
  payload: z.object({
    userIds: z.array(z.string()).describe('User IDs'),
    permissions: z.array(z.string()).nonempty().describe('List of user permissions'),
  }),
})

export const PERMISSIONS_REMOVE_MESSAGE_SCHEMA = BASE_MESSAGE_SCHEMA.extend({
  type: z.literal('remove'),
  payload: z.object({
    userIds: z.array(z.string()).describe('User IDs'),
    permissions: z.array(z.string()).nonempty().describe('List of user permissions'),
  }),
})

export type AddPermissionsMessageType = z.infer<typeof PERMISSIONS_ADD_MESSAGE_SCHEMA>
export type RemovePermissionsMessageType = z.infer<typeof PERMISSIONS_REMOVE_MESSAGE_SCHEMA>
