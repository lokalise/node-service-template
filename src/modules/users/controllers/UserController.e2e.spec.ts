import { randomUUID } from 'node:crypto'
import { describeApiContract } from '@lokalise/api-contracts'
import { injectByApiContract } from '@lokalise/fastify-api-contracts'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { cleanTables, DB_MODEL } from '../../../../test/DbCleaner.ts'
import { generateTestJwt, getTestConfigurationOverrides } from '../../../../test/jwtUtils.ts'
import type { AppInstance } from '../../../app.ts'
import { getApp } from '../../../app.ts'
import type { UserRepository } from '../repositories/UserRepository.ts'
import type { UserCreateDTO } from '../services/UserService.ts'
import { UserController } from './UserController.ts'

const NEW_USER_FIXTURE = {
  name: 'dummy',
  email: 'email@test.com',
  password: 'test-password',
} satisfies UserCreateDTO

const withAudience = (token: string, audience: 'public' | 'internal') => ({
  authorization: `Bearer ${token}`,
  'x-api-audience': audience,
})

describe('UserController', () => {
  let app: AppInstance
  let userRepository: UserRepository
  beforeAll(async () => {
    app = await getApp(getTestConfigurationOverrides())
    userRepository = app.diContainer.cradle.userRepository
  })
  beforeEach(async () => {
    await cleanTables(app.diContainer.cradle.drizzle, [DB_MODEL.User])
  })
  afterAll(async () => {
    await app.close()
  })

  describe(describeApiContract(UserController.contracts.createUser), () => {
    it('validates email format', async () => {
      const token = generateTestJwt({ userId: 1 })
      const response = await injectByApiContract(app, UserController.contracts.createUser, {
        headers: withAudience(token, 'public'),
        body: { name: 'dummy', email: 'test', password: 'test-password' },
      })

      expect(response.statusCode).toBe(400)
      expect(response.json()).toMatchInlineSnapshot(`
        {
          "code": "VALIDATION_ERROR",
          "details": {
            "error": [
              {
                "instancePath": "/email",
                "keyword": "invalid_format",
                "message": "Invalid email address",
                "params": {
                  "format": "email",
                  "origin": "string",
                  "pattern": "/^(?!\\.)(?!.*\\.\\.)([A-Za-z0-9_'+\\-\\.]*)[A-Za-z0-9_+-]@([A-Za-z0-9][A-Za-z0-9\\-]*\\.)+[A-Za-z]{2,}$/",
                },
                "schemaPath": "#/email/invalid_format",
              },
            ],
          },
          "errorCode": "VALIDATION_ERROR",
          "message": "Invalid params",
        }
      `)
    })

    it('creates user with correct payload', async () => {
      const token = generateTestJwt({ userId: 1 })
      const response = await injectByApiContract(app, UserController.contracts.createUser, {
        headers: withAudience(token, 'public'),
        body: NEW_USER_FIXTURE,
      })

      expect(response.statusCode).toBe(201)
      expect(response.json()).toEqual({
        data: {
          age: null,
          email: 'email@test.com',
          id: expect.any(String),
          name: 'dummy',
        },
      })
    })
  })

  describe(describeApiContract(UserController.contracts.getUser), () => {
    it('returns user when requested twice', async () => {
      const token = generateTestJwt({ userId: '1' })
      const newUser = await userRepository.createUser(NEW_USER_FIXTURE)
      const { id } = newUser

      const response1 = await injectByApiContract(app, UserController.contracts.getUser, {
        headers: withAudience(token, 'public'),
        pathParams: {
          userId: id,
        },
      })

      const response2 = await injectByApiContract(app, UserController.contracts.getUser, {
        headers: withAudience(token, 'public'),
        pathParams: {
          userId: id,
        },
      })

      expect(response1.statusCode).toBe(200)
      expect(response2.statusCode).toBe(200)
      // Public caller: the internal `password` field is stripped from the response.
      expect(response1.json().data.password).toBeUndefined()
      expect(response2.json().data.password).toBeUndefined()
    })

    it('returns 404 with the contract error payload for an unknown user', async () => {
      const token = generateTestJwt({ userId: '1' })
      const unknownUserId = randomUUID()

      const response = await injectByApiContract(app, UserController.contracts.getUser, {
        headers: withAudience(token, 'public'),
        pathParams: {
          userId: unknownUserId,
        },
      })

      expect(response.statusCode).toBe(404)
      expect(response.json()).toEqual({
        message: 'User not found',
        code: 'USER_NOT_FOUND',
        errorCode: 'USER_NOT_FOUND',
        details: { id: unknownUserId },
      })
    })
  })

  describe(describeApiContract(UserController.contracts.getUsersByIds), () => {
    it('batch-resolves users by their IDs', async () => {
      const token = generateTestJwt({ userId: 1 })
      const user1 = await userRepository.createUser(NEW_USER_FIXTURE)
      const user2 = await userRepository.createUser({
        name: 'second',
        email: 'second@test.com',
        password: 'test-password',
      })

      const response = await app.inject({
        method: 'POST',
        url: '/internal/users/get-by-ids',
        headers: {
          authorization: `Bearer ${token}`,
          'x-api-audience': 'internal',
        },
        payload: {
          userIds: [user1.id, user2.id],
        },
      })

      expect(response.statusCode).toBe(200)
      const ids = response.json().data.map((user: { id: string }) => user.id)
      expect(ids).toEqual(expect.arrayContaining([user1.id, user2.id]))
    })

    it('rejects an empty list of IDs', async () => {
      const token = generateTestJwt({ userId: 1 })

      const response = await app.inject({
        method: 'POST',
        url: '/internal/users/get-by-ids',
        headers: {
          authorization: `Bearer ${token}`,
          'x-api-audience': 'internal',
        },
        payload: {
          userIds: [],
        },
      })

      expect(response.statusCode).toBe(400)
    })

    it('gates a public caller (no internal audience) with a 404', async () => {
      const token = generateTestJwt({ userId: 1 })

      const response = await injectByApiContract(app, UserController.contracts.getUsersByIds, {
        headers: withAudience(token, 'public'),
        body: {
          userIds: [],
        },
      })

      expect(response.statusCode).toBe(404)
    })
  })

  describe(describeApiContract(UserController.contracts.deleteUser), () => {
    it('resets cache after deletion', async () => {
      const token = generateTestJwt({ userId: '1' })
      const newUser = await userRepository.createUser(NEW_USER_FIXTURE)
      const { id } = newUser

      const retrievedUser = await userRepository.getUser(id)

      await injectByApiContract(app, UserController.contracts.deleteUser, {
        headers: withAudience(token, 'public'),
        pathParams: {
          userId: id,
        },
      })

      const retrievedUser2 = await userRepository.getUser(id)

      expect(retrievedUser).toBeDefined()
      expect(retrievedUser2).toBeNull()
    })
  })

  describe(describeApiContract(UserController.contracts.updateUser), () => {
    it('resets cache after update', async () => {
      const token = generateTestJwt({ userId: 1 })
      const newUser = await userRepository.createUser(NEW_USER_FIXTURE)
      const { id } = newUser

      const updateResponse = await injectByApiContract(app, UserController.contracts.updateUser, {
        body: {
          name: 'updated',
        },
        pathParams: {
          userId: id,
        },
        headers: withAudience(token, 'public'),
      })

      const retrievedUser2 = await userRepository.getUser(id)
      expect(updateResponse.statusCode).toBe(204)
      expect(retrievedUser2).toEqual({
        email: 'email@test.com',
        age: null,
        id,
        name: 'updated',
        password: 'test-password',
      })
    })
  })
})
