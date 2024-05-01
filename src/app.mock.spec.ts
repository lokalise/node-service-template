import type { User } from '@prisma/client'
import { asClass } from 'awilix'

import type { AppInstance } from './app.js'
import { getApp } from './app.js'
import type { Dependencies } from './infrastructure/diConfig.js'
import { SINGLETON_CONFIG } from './infrastructure/diConfig.js'
import { UserService } from './modules/users/services/UserService.js'

class FakeUserService extends UserService {
  constructor() {
    super({} as Dependencies)
  }

  async getUser(): Promise<User> {
    return Promise.resolve({
      id: -1,
      age: null,
      email: 'dummy',
      name: 'dummy',
    })
  }
}

describe('dependency mocking', () => {
  let app: AppInstance
  beforeAll(async () => {
    app = await getApp(
      {},
      {
        userService: asClass(FakeUserService, SINGLETON_CONFIG),
      },
    )
  })

  afterAll(async () => {
    await app.close()
  })

  it('uses mock implementation', async () => {
    const { userService } = app.diContainer.cradle

    const result = await userService.getUser(1)

    expect(result.id).toBe(-1)
  })
})
