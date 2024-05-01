import type { Routes } from 'src/modules/routes'

import {
  deleteUser,
  getUser,
  patchUpdateUser,
  postCreateUser,
} from '../controllers/UserController.js'
import {
  CREATE_USER_BODY_SCHEMA,
  DELETE_USER_PARAMS_SCHEMA,
  GET_USER_PARAMS_SCHEMA,
  UPDATE_USER_BODY_SCHEMA,
  UPDATE_USER_PARAMS_SCHEMA,
} from '../schemas/userSchemas.js'

export const getUserRoutes = (): {
  routes: Routes
} => {
  return {
    routes: [
      {
        method: 'POST',
        url: '/users',
        handler: postCreateUser,
        schema: { body: CREATE_USER_BODY_SCHEMA, describe: 'Create user' },
      },
      {
        method: 'GET',
        url: `/users/:userId`,
        handler: getUser,
        schema: { params: GET_USER_PARAMS_SCHEMA, describe: 'Get user' },
      },
      {
        method: 'DELETE',
        url: `/users/:userId`,
        handler: deleteUser,
        schema: { params: DELETE_USER_PARAMS_SCHEMA, describe: 'Delete user' },
      },
      {
        method: 'PATCH',
        url: `/users/:userId`,
        handler: patchUpdateUser,
        schema: {
          params: UPDATE_USER_PARAMS_SCHEMA,
          body: UPDATE_USER_BODY_SCHEMA,
          describe: 'Update user',
        },
      },
    ],
  }
}
