import type { User } from '@prisma/client'
import type { DataSource } from 'layered-loader'

import type { UserRepository } from '../repositories/UserRepository.js'
import type { UsersInjectableDependencies } from '../userDiConfig.js'

export class UserDataSource implements DataSource<User> {
  name = 'User loader'
  private userRepository: UserRepository

  constructor({ userRepository }: UsersInjectableDependencies) {
    this.userRepository = userRepository
  }

  get(userId: string): Promise<User | null> {
    return this.userRepository.getUser(userId)
  }

  getMany(keys: string[]): Promise<User[]> {
    return this.userRepository.getUsers(keys)
  }
}
