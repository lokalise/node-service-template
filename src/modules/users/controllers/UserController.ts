import {
  buildFastifyNoPayloadRoute,
  buildFastifyPayloadRoute,
} from '@lokalise/fastify-api-contracts'
import { AbstractController, type BuildRoutesReturnType } from 'opinionated-machine'
import type { UsersInjectableDependencies } from '../UserModule.ts'
import {
  deleteUserContract,
  getUserContract,
  patchUpdateUserContract,
  postCreateUserContract,
} from '../schemas/userApiContracts.ts'
import type { UserService } from '../services/UserService.ts'

type UserControllerContractsType = typeof UserController.contracts

export class UserController extends AbstractController<UserControllerContractsType> {
  public static contracts = {
    createUser: postCreateUserContract,
    getUser: getUserContract,
    deleteUser: deleteUserContract,
    updateUser: patchUpdateUserContract,
  } as const

  private readonly userService: UserService

  constructor(dependencies: UsersInjectableDependencies) {
    super()
    this.userService = dependencies.userService
  }

  private createUser = buildFastifyPayloadRoute(postCreateUserContract, async (req, reply) => {
    const { name, email, age } = req.body
    const { userService } = req.diScope.cradle

    const createdUser = await userService.createUser({
      name,
      email,
      age,
    })

    return reply.status(201).send({
      data: createdUser,
    })
  })

  private getUser = buildFastifyNoPayloadRoute(getUserContract, async (req, reply) => {
    const { userId } = req.params
    const { reqContext } = req

    const user = await this.userService.getUser(reqContext, userId)

    return reply.send({
      data: user,
    })
  })

  private deleteUser = buildFastifyNoPayloadRoute(deleteUserContract, async (req, reply) => {
    const { userId } = req.params
    const { reqContext } = req

    await this.userService.deleteUser(reqContext, userId)

    return reply.status(204).send()
  })

  private updateUser = buildFastifyPayloadRoute(patchUpdateUserContract, async (req, reply) => {
    const { userId } = req.params
    const updatedUser = req.body
    const { reqContext } = req

    await this.userService.updateUser(reqContext, userId, updatedUser)

    return reply.status(204).send()
  })

  buildRoutes(): BuildRoutesReturnType<UserControllerContractsType> {
    return {
      createUser: this.createUser,
      getUser: this.getUser,
      deleteUser: this.deleteUser,
      updateUser: this.updateUser,
    }
  }
}
