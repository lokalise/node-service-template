import type { CommonLogger } from '@lokalise/node-core'
import { globalLogger } from '@lokalise/node-core'
import type { Connection } from 'amqplib'
import type { AwilixContainer, NameAndRegistrationPair, Resolver } from 'awilix'
import { Lifetime } from 'awilix'

import type { AppInstance } from '../app.js'
import type { UsersModuleDependencies } from '../modules/users/userDiConfig.js'
import { resolveUsersConfig } from '../modules/users/userDiConfig.js'

import type { CommonDependencies } from './commonDiConfig.js'
import { resolveCommonDiConfig } from './commonDiConfig.js'
import type { DIOptions } from './diConfigUtils.js'

export type ExternalDependencies = {
  app?: AppInstance
  logger: CommonLogger
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
