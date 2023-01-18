import { FastifyInstance } from 'fastify'

export function getConsumers(app: FastifyInstance) {
  const { permissionConsumer } = app.diContainer.cradle

  return [ permissionConsumer ]
}
