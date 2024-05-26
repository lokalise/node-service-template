import type { AmqpAwareEventDefinition } from '@message-queue-toolkit/amqp'
import { enrichMessageSchemaWithBase } from '@message-queue-toolkit/core'
import z from 'zod'

// Rename into consumer service name when using in real code
export const SERVICE_TEMPLATE_PERMISSIONS_QUEUE = 'service_template.user_permissions'

export const PERMISSIONS_EXCHANGE = 'permissions'

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
    exchange: PERMISSIONS_EXCHANGE,
  },

  removed: {
    ...enrichMessageSchemaWithBase(
      'permissions.removed',
      z.object({
        userIds: z.array(z.string()).describe('User IDs'),
        permissions: z.array(z.string()).nonempty().describe('List of user permissions'),
      }),
    ),
    exchange: PERMISSIONS_EXCHANGE,
  },
} as const satisfies Record<string, AmqpAwareEventDefinition>
