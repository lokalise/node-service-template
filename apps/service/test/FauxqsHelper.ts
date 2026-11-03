import { type FauxqsServer, startFauxqs } from 'fauxqs'
import {
  SERVICE_TEMPLATE_USER_EVENTS_QUEUE,
  USER_EVENTS_TOPIC,
} from '../src/modules/users/consumers/userEventMessageSchemas.ts'

let server: FauxqsServer

export async function startTestFauxqs(): Promise<FauxqsServer> {
  server = await startFauxqs({
    port: 4567,
    logger: false,
    messageSpies: true,
    // Same as AWS_REGION in .env.test, so the seeded resources are found
    defaultRegion: 'eu-central-1',
  })
  seedTestFauxqs()

  return server
}

/**
 * Creates the topics, queues and subscriptions that Terraform provides in deployed environments,
 * as consumers only locate them. Resources that already exist are kept.
 */
export function seedTestFauxqs(): ReturnType<FauxqsServer['setup']> {
  return server.setup({
    queues: [{ name: SERVICE_TEMPLATE_USER_EVENTS_QUEUE }],
    topics: [{ name: USER_EVENTS_TOPIC }],
    subscriptions: [{ topic: USER_EVENTS_TOPIC, queue: SERVICE_TEMPLATE_USER_EVENTS_QUEUE }],
  })
}

export async function stopTestFauxqs(): Promise<void> {
  await server?.stop()
}
