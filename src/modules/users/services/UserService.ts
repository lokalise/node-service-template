import type { RequestContext } from '@lokalise/fastify-extras'
import type { User } from '@prisma/client'
import type { Loader } from 'layered-loader'

import { EntityNotFoundError } from '../../../infrastructure/errors/publicErrors.js'
import type { UserRepository } from '../repositories/UserRepository.js'
import type {
  CREATE_USER_BODY_SCHEMA_TYPE,
  UPDATE_USER_BODY_SCHEMA_TYPE,
  USER_SCHEMA_TYPE,
} from '../schemas/userSchemas.js'
import type { UsersInjectableDependencies } from '../userDiConfig.js'

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
      age: user.age ?? null,
      email: user.email,
    })
    await this.userLoader.invalidateCacheFor(newUser.id.toString())
    return newUser
  }

  async getUser(requestContext: RequestContext, userId: string): Promise<User> {
    const getUserResult =
      this.userLoader.getInMemoryOnly(userId.toString()) ?? (await this.userLoader.get(userId))

    if (!getUserResult) {
      throw new EntityNotFoundError({ message: 'User not found', details: { id: userId } })
    }

    requestContext.logger.debug({ userId }, 'Resolved user')
    return getUserResult
  }

  async deleteUser(requestContext: RequestContext, userId: string): Promise<void> {
    await this.userRepository.deleteUser(userId)
    await this.userLoader.invalidateCacheFor(userId.toString())

    requestContext.logger.info({ userId }, 'Deleted user')
  }

  async updateUser(requestContext: RequestContext, userId: string, updatedData: UserUpdateDTO) {
    await this.userRepository.updateUser(userId, updatedData)
    await this.userLoader.invalidateCacheFor(userId)

    requestContext.logger.info({ userId }, 'Updated user')
  }

  async getUsers(requestContext: RequestContext, userIds: string[]): Promise<UserDTO[]> {
    const users = await this.userRepository.getUsers(userIds)

    requestContext.logger.debug({ userIds }, 'Resolved users')
    return users
  }

  async findUserById(requestContext: RequestContext, id: string): Promise<UserDTO | null> {
    const getUserResult =
      this.userLoader.getInMemoryOnly(id.toString()) ?? (await this.userLoader.get(id))

    if (getUserResult) {
      requestContext.logger.debug({ id }, 'Resolved user')
      return getUserResult
    }

    requestContext.logger.debug({ id }, 'User does not exist')
    return null
  }
}
