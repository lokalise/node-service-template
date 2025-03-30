import type { AbstractModule } from 'opinionated-machine'
import { CommonModule } from './infrastructure/CommonModule.js'
import { UserModule } from './modules/users/UserModule.js'

export const ALL_MODULES: readonly AbstractModule<unknown>[] = [
  new CommonModule(),
  new UserModule(),
]
