import type { RequestContext } from '@lokalise/fastify-extras'
import type {
  CreateUserRequestBody,
  UpdateUserRequestBody,
  User as UserApiObject,
} from '@node-service-template/api-contracts'
import type { Loader } from 'layered-loader'
import type { User } from '../../../db/schema/user.ts'
import { UserNotFoundError } from '../errors/UserNotFoundError.ts'
import type { UserRepository } from '../repositories/UserRepository.ts'
import type { UsersInjectableDependencies } from '../UserModule.ts'

export type UserDTO = UserApiObject
export type UserCreateDTO = CreateUserRequestBody
export type UserUpdateDTO = UpdateUserRequestBody

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
      internalNote: user.internalNote,
    })
    await this.userLoader.invalidateCacheFor(newUser.id.toString())
    return newUser
  }

  async getUser(requestContext: RequestContext, userId: string): Promise<User> {
    const getUserResult =
      this.userLoader.getInMemoryOnly(userId.toString()) ?? (await this.userLoader.get(userId))

    if (!getUserResult) {
      throw new UserNotFoundError(userId)
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
