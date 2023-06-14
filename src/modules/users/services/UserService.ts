import type { User } from '@prisma/client'
import type { Loader } from 'layered-loader'

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
  private readonly userLoader: Loader<User>

  constructor({ userRepository, userLoader }: Dependencies) {
    this.userRepository = userRepository
    this.userLoader = userLoader
  }

  async createUser(user: NewUserDTO) {
    const newUser = await this.userRepository.createUser({
      name: user.name ?? null,
      email: user.email,
    })
    await this.userLoader.invalidateCacheFor(newUser.id.toString())
    return newUser
  }

  async getUser(id: number): Promise<User> {
    const getUserResult =
      this.userLoader.getInMemoryOnly(id.toString()) ?? (await this.userLoader.get(id.toString()))

    if (!getUserResult) {
      throw new EntityNotFoundError({ message: 'User not found', details: { id } })
    }

    return getUserResult
  }

  async deleteUser(id: number): Promise<void> {
    await this.userRepository.deleteUser(id)
    await this.userLoader.invalidateCacheFor(id.toString())
  }

  async updateUser(id: number, updatedData: Partial<Pick<User, 'id'>>) {
    await this.userRepository.updateUser(id, updatedData)
    await this.userLoader.invalidateCacheFor(id.toString())
  }

  async getUsers(userIds: number[]): Promise<User[]> {
    const users = await this.userRepository.getUsers(userIds)

    return users
  }

  async findUserById(id: number): Promise<User | null> {
    const getUserResult =
      this.userLoader.getInMemoryOnly(id.toString()) ?? (await this.userLoader.get(id.toString()))

    return getUserResult ?? null
  }
}
