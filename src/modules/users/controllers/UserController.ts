import {
  type RouteType,
  buildFastifyNoPayloadRoute,
  buildFastifyPayloadRoute,
} from '@lokalise/fastify-api-contracts'
import { AbstractController } from 'opinionated-machine'
import type { UsersInjectableDependencies } from '../UserModule.js'
import {
  deleteUserContract,
  getUserContract,
  patchUpdateUserContract,
  postCreateUserContract,
} from '../schemas/userApiContracts.js'

export class UserController extends AbstractController<typeof UserController.contracts> {
  public static contracts = {
    createUser: postCreateUserContract,
    getUser: getUserContract,
    deleteUser: deleteUserContract,
    updateUser: patchUpdateUserContract,
  } as const

  // cannot inject userService here, because that will start requiring infra dependencies on OpenAPI spec generation step
  constructor(_dependencies: UsersInjectableDependencies) {
    super()
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
    const { userService } = req.diScope.cradle

    const user = await userService.getUser(reqContext, userId)

    return reply.send({
      data: user,
    })
  })

  private deleteUser = buildFastifyNoPayloadRoute(deleteUserContract, async (req, reply) => {
    const { userId } = req.params
    const { reqContext } = req
    const { userService } = req.diScope.cradle

    await userService.deleteUser(reqContext, userId)

    return reply.status(204).send()
  })

  private updateUser = buildFastifyPayloadRoute(patchUpdateUserContract, async (req, reply) => {
    const { userId } = req.params
    const updatedUser = req.body
    const { reqContext } = req
    const { userService } = req.diScope.cradle

    await userService.updateUser(reqContext, userId, updatedUser)

    return reply.status(204).send()
  })

  buildRoutes(): Record<keyof typeof UserController.contracts, RouteType> {
    return {
      createUser: this.createUser,
      getUser: this.getUser,
      deleteUser: this.deleteUser,
      updateUser: this.updateUser,
    }
  }
}
