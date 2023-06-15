import type { FastifyReply, FastifyRequest } from 'fastify'

import type {
  CREATE_USER_BODY_SCHEMA_TYPE,
  DELETE_USER_PARAMS_SCHEMA_TYPE,
  GET_USER_PARAMS_SCHEMA_TYPE,
  UPDATE_USER_BODY_SCHEMA_TYPE,
  UPDATE_USER_PARAMS_SCHEMA_TYPE,
} from '../schemas/userSchemas'

export const postCreateUser = async (
  req: FastifyRequest<{ Body: CREATE_USER_BODY_SCHEMA_TYPE }>,
  reply: FastifyReply,
): Promise<void> => {
  const { name, email } = req.body

  const { userService } = req.diScope.cradle

  const createdUser = await userService.createUser({
    name,
    email,
  })

  return reply.status(201).send({
    data: createdUser,
  })
}

export const getUser = async (
  req: FastifyRequest<{ Params: GET_USER_PARAMS_SCHEMA_TYPE }>,
  reply: FastifyReply,
): Promise<void> => {
  const { userId } = req.params

  const { userService } = req.diScope.cradle

  const user = await userService.getUser(userId)

  return reply.send({
    data: user,
  })
}

export const deleteUser = async (
  req: FastifyRequest<{ Params: DELETE_USER_PARAMS_SCHEMA_TYPE }>,
  reply: FastifyReply,
): Promise<void> => {
  const { userId } = req.params

  const { userService } = req.diScope.cradle

  await userService.deleteUser(userId)

  return reply.status(204).send()
}

export const patchUpdateUser = async (
  req: FastifyRequest<{
    Params: UPDATE_USER_PARAMS_SCHEMA_TYPE
    Body: UPDATE_USER_BODY_SCHEMA_TYPE
  }>,
  reply: FastifyReply,
): Promise<void> => {
  const { userId } = req.params
  const updatedUser = req.body

  const { userService } = req.diScope.cradle

  await userService.updateUser(userId, updatedUser)

  return reply.status(204).send()
}
