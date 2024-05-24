import type http from 'node:http'

import type { CommonLogger } from '@lokalise/node-core'
import type { RouteOptions } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'

import { getUserRoutes } from './users/index.js'

export type Routes = Array<
  RouteOptions<
    http.Server,
    http.IncomingMessage,
    http.ServerResponse,
    // biome-ignore lint/suspicious/noExplicitAny: it's ok
    any,
    // biome-ignore lint/suspicious/noExplicitAny: it's ok
    any,
    // biome-ignore lint/suspicious/noExplicitAny: it's ok
    any,
    ZodTypeProvider,
    CommonLogger
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
