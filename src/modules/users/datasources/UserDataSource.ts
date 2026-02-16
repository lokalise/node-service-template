import type { DataSource } from 'layered-loader'

import type { User } from '../../../db/schema/user.ts'
import type { UserRepository } from '../repositories/UserRepository.ts'

export class UserDataSource implements DataSource<User> {
  name = 'User loader'
  private userRepository: UserRepository

  constructor({ userRepository }: { userRepository: UserRepository }) {
    this.userRepository = userRepository
  }

  get(userId: string): Promise<User | null> {
    return this.userRepository.getUser(userId)
  }

  getMany(keys: string[]): Promise<User[]> {
    return this.userRepository.getUsers(keys)
  }
}
