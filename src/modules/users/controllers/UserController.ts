import {
  buildFastifyNoPayloadRoute,
  buildFastifyPayloadRoute,
} from '@lokalise/fastify-api-contracts'
import {
  deleteUserContract,
  getUserContract,
  patchUpdateUserContract,
  postCreateUserContract,
} from '../schemas/userApiContracts.js'

export const postCreateUserRoute = buildFastifyPayloadRoute(
  postCreateUserContract,
  async (req, reply) => {
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
  },
)

export const getUserRoute = buildFastifyNoPayloadRoute(getUserContract, async (req, reply) => {
  const { userId } = req.params
  const { reqContext } = req

  const { userService } = req.diScope.cradle

  const user = await userService.getUser(reqContext, userId)

  return reply.send({
    data: user,
  })
})

export const deleteUserRoute = buildFastifyNoPayloadRoute(
  deleteUserContract,
  async (req, reply) => {
    const { userId } = req.params
    const { reqContext } = req

    const { userService } = req.diScope.cradle

    await userService.deleteUser(reqContext, userId)

    return reply.status(204).send()
  },
)

export const patchUpdateUserRoute = buildFastifyPayloadRoute(
  patchUpdateUserContract,
  async (req, reply) => {
    const { userId } = req.params
    const updatedUser = req.body
    const { reqContext } = req

    const { userService } = req.diScope.cradle

    await userService.updateUser(reqContext, userId, updatedUser)

    return reply.status(204).send()
  },
)
