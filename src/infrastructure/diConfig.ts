import { globalLogger } from '@lokalise/node-core'
import type { Connection } from 'amqplib'
import type { AwilixContainer, NameAndRegistrationPair, Resolver } from 'awilix'
import { Lifetime } from 'awilix'
import type { FastifyBaseLogger, FastifyInstance } from 'fastify'

import type { UsersModuleDependencies } from '../modules/users/diConfig'
import { resolveUsersConfig } from '../modules/users/diConfig'

import type { CommonDependencies } from './commonDiConfig'
import { resolveCommonDiConfig } from './commonDiConfig'
import type { DIOptions } from './diConfigUtils'

export type ExternalDependencies = {
  app?: FastifyInstance
  logger: FastifyBaseLogger
  amqpConnection?: Connection
}
export const SINGLETON_CONFIG = { lifetime: Lifetime.SINGLETON }

export type DependencyOverrides = Partial<DiConfig>
export type Dependencies = CommonDependencies & UsersModuleDependencies
type DiConfig = NameAndRegistrationPair<Dependencies>

export function registerDependencies(
  diContainer: AwilixContainer,
  dependencies: ExternalDependencies = { logger: globalLogger },
  dependencyOverrides: DependencyOverrides = {},
  options: DIOptions = {},
): void {
  const diConfig: DiConfig = {
    ...resolveCommonDiConfig(dependencies, options),
    ...resolveUsersConfig(options),
  }
  diContainer.register(diConfig)

  for (const [dependencyKey, dependencyValue] of Object.entries(dependencyOverrides)) {
    diContainer.register(dependencyKey, dependencyValue as Resolver<unknown>)
  }
}

declare module '@fastify/awilix' {
  // eslint-disable-next-line @typescript-eslint/no-empty-interface
  interface Cradle extends Dependencies {}

  // eslint-disable-next-line @typescript-eslint/no-empty-interface
  interface RequestCradle extends Dependencies {}
}
