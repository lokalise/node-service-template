import type { DataSource } from 'layered-loader'

import type { User } from '../../../db/schema/user.js'
import type { UsersInjectableDependencies } from '../UserModule.js'
import type { UserRepository } from '../repositories/UserRepository.js'

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
