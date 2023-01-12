import type { Routes } from 'src/modules/routes'

import { CREATE_USER_SCHEMA } from '../../../schemas/userSchemas'
import { postCreateUser } from '../controllers/UserController'

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
    ],
  }
}
