import type { Routes } from 'src/modules/routes'

import { getUser, postCreateUser } from '../controllers/UserController'
import { CREATE_USER_SCHEMA, GET_USER_SCHEMA } from '../schemas/userSchemas'

export const getUserRoutes = (): {
  routes: Routes
} => {
  return {
    routes: [
      {
        method: 'POST',
        url: '/users',
        handler: postCreateUser,
        schema: { body: CREATE_USER_SCHEMA, describe: 'Create user' },
      },
      {
        method: 'GET',
        url: `/users/:userId`,
        handler: getUser,
        schema: { params: GET_USER_SCHEMA, describe: 'Get user' },
      },
    ],
  }
}
