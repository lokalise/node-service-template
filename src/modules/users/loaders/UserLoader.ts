import type { User } from '@prisma/client'
import type { DataSource } from 'layered-loader'

import type { Dependencies } from '../../../infrastructure/diConfig'
import type { UserRepository } from '../repositories/UserRepository'

export class UserLoader implements DataSource<User> {
  name = 'User loader'
  private userRepository: UserRepository

  constructor({ userRepository }: Dependencies) {
    this.userRepository = userRepository
  }

  get(userId: string): Promise<User | null> {
    return this.userRepository.getUser(Number.parseInt(userId))
  }
}
