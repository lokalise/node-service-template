import {
  buildFastifyNoPayloadRoute,
  buildFastifyPayloadRoute,
} from '@lokalise/fastify-api-contracts'
import {
  buildDeleteRoute,
  buildGetRoute,
  buildPayloadRoute,
} from '@lokalise/universal-ts-utils/api-contracts/apiContracts'
import z from 'zod'
import {
  AUTH_HEADERS,
  CREATE_USER_BODY_SCHEMA,
  CREATE_USER_RESPONSE_BODY_SCHEMA,
  DELETE_USER_PARAMS_SCHEMA,
  GET_USER_PARAMS_SCHEMA,
  GET_USER_SCHEMA_RESPONSE_SCHEMA,
  UPDATE_USER_BODY_SCHEMA,
  UPDATE_USER_PARAMS_SCHEMA,
} from '../schemas/userSchemas.js'

export const postCreateUserContract = buildPayloadRoute({
  method: 'post', // can also be 'patch' or 'post'
  successResponseBodySchema: CREATE_USER_RESPONSE_BODY_SCHEMA,
  requestHeaderSchema: AUTH_HEADERS,
  requestBodySchema: CREATE_USER_BODY_SCHEMA,
  pathResolver: () => '/users',
  description: 'Create user',
})

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

export const getUserContract = buildGetRoute({
  successResponseBodySchema: GET_USER_SCHEMA_RESPONSE_SCHEMA,
  requestPathParamsSchema: GET_USER_PARAMS_SCHEMA,
  requestHeaderSchema: AUTH_HEADERS,
  pathResolver: (params) => `/users/${params.userId}`,
  description: 'Get user',
})

export const getUserRoute = buildFastifyNoPayloadRoute(getUserContract, async (req, reply) => {
  const { userId } = req.params
  const { reqContext } = req

  const { userService } = req.diScope.cradle

  const user = await userService.getUser(reqContext, userId)

  return reply.send({
    data: user,
  })
})

export const deleteUserContract = buildDeleteRoute({
  successResponseBodySchema: z.undefined(),
  requestPathParamsSchema: DELETE_USER_PARAMS_SCHEMA,
  pathResolver: (params) => `/users/${params.userId}`,
  description: 'Delete user',
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

export const patchUpdateUserContract = buildPayloadRoute({
  method: 'patch', // can also be 'patch' or 'post'
  successResponseBodySchema: z.undefined(),
  isEmptyResponseExpected: true,
  requestBodySchema: UPDATE_USER_BODY_SCHEMA,
  requestPathParamsSchema: UPDATE_USER_PARAMS_SCHEMA,
  requestHeaderSchema: AUTH_HEADERS,
  pathResolver: (params) => `/users/${params.userId}`,
  description: 'Update user',
})

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
