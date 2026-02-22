import { type FauxqsServer, startFauxqs } from 'fauxqs'
import {
  SERVICE_TEMPLATE_USER_EVENTS_QUEUE,
  USER_EVENTS_TOPIC,
} from '../src/modules/users/consumers/userEventMessageSchemas.ts'

let server: FauxqsServer

export async function startTestFauxqs(): Promise<FauxqsServer> {
  server = await startFauxqs({ port: 4567, logger: false, messageSpies: true })
  server.setup({
    queues: [{ name: SERVICE_TEMPLATE_USER_EVENTS_QUEUE }],
    topics: [{ name: USER_EVENTS_TOPIC }],
    subscriptions: [{ topic: USER_EVENTS_TOPIC, queue: SERVICE_TEMPLATE_USER_EVENTS_QUEUE }],
  })

  return server
}

export async function stopTestFauxqs(): Promise<void> {
  await server?.stop()
}
