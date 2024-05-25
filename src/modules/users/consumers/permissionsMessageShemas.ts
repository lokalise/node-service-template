import type { AmqpAwareEventDefinition } from '@message-queue-toolkit/amqp'
import { enrichMessageSchemaWithBase } from '@message-queue-toolkit/core'
import z from 'zod'

export const PERMISSIONS_QUEUE = 'user_permissions'

export const PermissionsMessages = {
  added: {
    ...enrichMessageSchemaWithBase(
      'permissions.added',
      z.object({
        userIds: z.array(z.string()).describe('User IDs'),
        permissions: z.array(z.string()).nonempty().describe('List of user permissions'),
      }),
    ),
    schemaVersion: '1.0.1',
    queueName: PERMISSIONS_QUEUE,
  },

  removed: {
    ...enrichMessageSchemaWithBase(
      'permissions.removed',
      z.object({
        userIds: z.array(z.string()).describe('User IDs'),
        permissions: z.array(z.string()).nonempty().describe('List of user permissions'),
      }),
    ),
    queueName: PERMISSIONS_QUEUE,
  },
} as const satisfies Record<string, AmqpAwareEventDefinition>
