import type { User } from '@prisma/client'
import type { Loader } from 'layered-loader'

import { EntityNotFoundError } from '../../../infrastructure/errors/publicErrors'
import type { UsersInjectableDependencies } from '../diConfig'
import type { UserRepository } from '../repositories/UserRepository'
import type {
  CREATE_USER_BODY_SCHEMA_TYPE,
  UPDATE_USER_BODY_SCHEMA_TYPE,
  USER_SCHEMA_TYPE,
} from '../schemas/userSchemas'

export type UserDTO = USER_SCHEMA_TYPE
export type UserCreateDTO = CREATE_USER_BODY_SCHEMA_TYPE
export type UserUpdateDTO = UPDATE_USER_BODY_SCHEMA_TYPE

export class UserService {
  private readonly userRepository: UserRepository
  private readonly userLoader: Loader<User>

  constructor({ userRepository, userLoader }: UsersInjectableDependencies) {
    this.userRepository = userRepository
    this.userLoader = userLoader
  }

  async createUser(user: UserCreateDTO) {
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

  async updateUser(id: number, updatedData: UserUpdateDTO) {
    await this.userRepository.updateUser(id, updatedData)
    await this.userLoader.invalidateCacheFor(id.toString())
  }

  async getUsers(userIds: number[]): Promise<UserDTO[]> {
    const users = await this.userRepository.getUsers(userIds)

    return users
  }

  async findUserById(id: number): Promise<UserDTO | null> {
    const getUserResult =
      this.userLoader.getInMemoryOnly(id.toString()) ?? (await this.userLoader.get(id.toString()))

    return getUserResult ?? null
  }
}
