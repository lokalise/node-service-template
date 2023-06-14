import type { FastifyReply, FastifyRequest } from 'fastify'

import type { CREATE_USER_SCHEMA_TYPE, GET_USER_SCHEMA_TYPE } from '../schemas/userSchemas'

export const postCreateUser = async (
  req: FastifyRequest<{ Body: CREATE_USER_SCHEMA_TYPE }>,
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
  req: FastifyRequest<{ Params: GET_USER_SCHEMA_TYPE }>,
  reply: FastifyReply,
): Promise<void> => {
  const { userId } = req.params

  const { userService } = req.diScope.cradle

  const user = await userService.getUser(userId)

  return reply.send({
    data: user,
  })
}
