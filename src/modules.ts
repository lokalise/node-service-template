import type { AbstractModule } from 'opinionated-machine'
import { CommonModule } from './infrastructure/CommonModule.ts'
import { UsersModule } from './modules/users/UsersModule.ts'

export const ALL_MODULES: readonly AbstractModule<unknown>[] = [
  new CommonModule(),
  new UsersModule(),
]
