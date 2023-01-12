import type http from 'http'

import type { FastifyBaseLogger, RouteOptions } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'

import { getUserRoutes } from './users'

export type Routes = Array<
  RouteOptions<
    http.Server,
    http.IncomingMessage,
    http.ServerResponse,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    any,
    ZodTypeProvider,
    FastifyBaseLogger
  >
>

export function getRoutes(): {
  routes: Routes
} {
  const { routes: userRoutes } = getUserRoutes()

  return {
    routes: [...userRoutes],
  }
}
