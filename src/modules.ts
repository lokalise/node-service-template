import type { AbstractModule } from 'opinionated-machine'
import { CommonModule } from './infrastructure/CommonModule.ts'
import { UserModule } from './modules/users/UserModule.ts'

export const ALL_MODULES: readonly AbstractModule<unknown>[] = [
  new CommonModule(),
  new UserModule(),
]
