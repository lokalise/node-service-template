import type { SnsAwareEventDefinition } from '@message-queue-toolkit/schemas'
import { enrichMessageSchemaWithBase } from '@message-queue-toolkit/core'
import z from 'zod/v4'

export const SERVICE_TEMPLATE_USER_EVENTS_QUEUE = 'service_template.user_events'

export const USER_EVENTS_TOPIC = 'user-events'

export const UserEventMessages = {
  created: {
    ...enrichMessageSchemaWithBase(
      'user.created',
      z.object({
        userId: z.string().describe('User ID'),
        name: z.string().describe('User name'),
        email: z.string().describe('User email'),
      }),
    ),
    snsTopic: USER_EVENTS_TOPIC,
  },
} as const satisfies Record<string, SnsAwareEventDefinition>
