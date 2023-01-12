import type { FastifyReply, FastifyRequest } from 'fastify'

import type { CREATE_USER_SCHEMA_TYPE } from '../../../schemas/userSchemas'

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

  return reply.send({
    data: createdUser,
  })
}
