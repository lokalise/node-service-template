import type { Routes } from '../../routes.js'

import {
  deleteUserRoute,
  getUserRoute,
  patchUpdateUserRoute,
  postCreateUserRoute,
} from '../controllers/UserController.js'

export const getUserRoutes = (): {
  routes: Routes
} => {
  return {
    routes: [postCreateUserRoute, getUserRoute, deleteUserRoute, patchUpdateUserRoute],
  }
}
