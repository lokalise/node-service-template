import { asServiceClass } from 'opinionated-machine'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createRequestContext } from '../test/requestUtils.js'
import type { AppInstance } from './app.js'
import { getApp } from './app.js'
import type { User } from './db/schema/user.js'
import type { Dependencies } from './infrastructure/CommonModule.js'
import { UserService } from './modules/users/services/UserService.js'

class FakeUserService extends UserService {
  constructor() {
    super({} as Dependencies)
  }

  override getUser(): Promise<User> {
    return Promise.resolve({
      id: '-1',
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
        userService: asServiceClass(FakeUserService),
      },
    )
  })

  afterAll(async () => {
    await app.close()
  })

  it('uses mock implementation', async () => {
    const { userService } = app.diContainer.cradle

    const result = await userService.getUser(createRequestContext(), '1')

    expect(result.id).toBe('-1')
  })
})
