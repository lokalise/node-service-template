import type { User } from '@prisma/client'

import type { Dependencies } from '../../../infrastructure/diConfig'
import { EntityNotFoundError } from '../../../infrastructure/errors/publicErrors'
import type { UserRepository } from '../repositories/UserRepository'

export type NewUserDTO = Omit<UserDTO, 'id'>

export type UserDTO = {
  id: number
  email: string
  name?: string
}

export class UserService {
  private readonly userRepository: UserRepository

  constructor({ userRepository }: Dependencies) {
    this.userRepository = userRepository
  }

  async createUser(user: NewUserDTO) {
    return await this.userRepository.createUser({
      name: user.name ?? null,
      email: user.email,
    })
  }

  async getUser(id: number): Promise<User> {
    const getUserResult = await this.userRepository.getUser(id)

    if (getUserResult.error) {
      throw new EntityNotFoundError({ message: 'User not found', details: { id } })
    }

    return getUserResult.result
  }

  async getUsers(userIds: number[]): Promise<User[]> {
    const users = await this.userRepository.getUsers(userIds)

    return users
  }

  async findUserById(id: number): Promise<User | null> {
    const getUserResult = await this.userRepository.getUser(id)

    if (getUserResult.error) {
      return null
    }

    return getUserResult.result
  }
}
