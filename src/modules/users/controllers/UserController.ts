import {
  deleteUserContract,
  getUserContract,
  patchUpdateUserContract,
  postCreateUserContract,
  postGetUsersByIdsContract,
} from '@node-service-template/api-contracts'
import type { RouteOptions } from 'fastify'
import { AbstractApiController, buildApiRoute } from 'opinionated-machine'
import type { UserService } from '../services/UserService.ts'
import type { UsersInjectableDependencies } from '../UserModule.ts'

type UserControllerContractsType = typeof UserController.contracts

export class UserController extends AbstractApiController<UserControllerContractsType> {
  public static contracts = {
    createUser: postCreateUserContract,
    getUser: getUserContract,
    getUsersByIds: postGetUsersByIdsContract,
    deleteUser: deleteUserContract,
    updateUser: patchUpdateUserContract,
  } as const

  private readonly userService: UserService

  constructor(dependencies: UsersInjectableDependencies) {
    super()
    this.userService = dependencies.userService
  }

  public readonly routes: Record<keyof UserControllerContractsType, RouteOptions> = {
    createUser: buildApiRoute(UserController.contracts.createUser, async (req) => {
      const { name, email, age } = req.body

      const createdUser = await this.userService.createUser({
        name,
        email,
        age,
      })

      return { status: 201, body: { data: createdUser } }
    }),

    getUser: buildApiRoute(UserController.contracts.getUser, async (req) => {
      const { userId } = req.params
      const { reqContext } = req

      const user = await this.userService.getUser(reqContext, userId)

      return { status: 200, body: { data: user } }
    }),

    getUsersByIds: buildApiRoute(UserController.contracts.getUsersByIds, async (req) => {
      const { userIds } = req.body
      const { reqContext } = req

      const users = await this.userService.getUsers(reqContext, userIds)

      return { status: 200, body: { data: users } }
    }),

    deleteUser: buildApiRoute(UserController.contracts.deleteUser, async (req) => {
      const { userId } = req.params
      const { reqContext } = req

      await this.userService.deleteUser(reqContext, userId)

      return { status: 204, body: null }
    }),

    updateUser: buildApiRoute(UserController.contracts.updateUser, async (req) => {
      const { userId } = req.params
      const updatedUser = req.body
      const { reqContext } = req

      await this.userService.updateUser(reqContext, userId, updatedUser)

      return { status: 204, body: null }
    }),
  }
}
