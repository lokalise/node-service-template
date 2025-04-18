import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { injectDelete, injectGet, injectPatch, injectPost } from '@lokalise/fastify-api-contracts'
import { DB_MODEL, cleanTables } from '../../../../test/DbCleaner.ts'
import { getTestConfigurationOverrides } from '../../../../test/jwtUtils.ts'
import type { AppInstance } from '../../../app.ts'
import { getApp } from '../../../app.ts'
import { generateJwtToken } from '../../../infrastructure/tokenUtils.ts'
import type { UserRepository } from '../repositories/UserRepository.ts'
import type { UserCreateDTO } from '../services/UserService.ts'
import { UserController } from './UserController.ts'

const NEW_USER_FIXTURE = { name: 'dummy', email: 'email@test.com' } satisfies UserCreateDTO

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

  describe('POST /users', () => {
    it('validates email format', async () => {
      const token = await generateJwtToken(app.jwt, { userId: 1 }, 9999)
      const response = await injectPost(app, UserController.contracts.createUser, {
        headers: {
          authorization: `Bearer ${token}`,
        },
        body: { name: 'dummy', email: 'test' },
      })

      expect(response.statusCode).toBe(400)
      expect(response.json()).toMatchInlineSnapshot(`
        {
          "details": {
            "error": [
              {
                "instancePath": "/email",
                "keyword": "invalid_string",
                "message": "Invalid email",
                "params": {
                  "issue": {
                    "code": "invalid_string",
                    "message": "Invalid email",
                    "path": [
                      "email",
                    ],
                    "validation": "email",
                  },
                },
                "schemaPath": "#/email/invalid_string",
              },
            ],
          },
          "errorCode": "VALIDATION_ERROR",
          "message": "Invalid params",
        }
      `)
    })

    it('creates user with correct payload', async () => {
      const token = await generateJwtToken(app.jwt, { userId: 1 }, 9999)
      const response = await injectPost(app, UserController.contracts.createUser, {
        headers: {
          authorization: `Bearer ${token}`,
        },
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

  describe('GET /users/:userId', () => {
    it('returns user when requested twice', async () => {
      const token = await generateJwtToken(app.jwt, { userId: '1' }, 9999)
      const newUser = await userRepository.createUser(NEW_USER_FIXTURE)
      const { id } = newUser

      const response1 = await injectGet(app, UserController.contracts.getUser, {
        headers: {
          authorization: `Bearer ${token}`,
        },
        pathParams: {
          userId: id,
        },
      })

      const response2 = await injectGet(app, UserController.contracts.getUser, {
        headers: {
          authorization: `Bearer ${token}`,
        },
        pathParams: {
          userId: id,
        },
      })

      expect(response1.statusCode).toBe(200)
      expect(response2.statusCode).toBe(200)
      expect(response1.json().data).toMatchObject(NEW_USER_FIXTURE)
      expect(response2.json().data).toMatchObject(NEW_USER_FIXTURE)
    })
  })

  describe('DELETE /users/:userId', () => {
    it('resets cache after deletion', async () => {
      const token = await generateJwtToken(app.jwt, { userId: '1' }, 9999)
      const newUser = await userRepository.createUser(NEW_USER_FIXTURE)
      const { id } = newUser

      const retrievedUser = await userRepository.getUser(id)

      await injectDelete(app, UserController.contracts.deleteUser, {
        headers: {
          authorization: `Bearer ${token}`,
        },
        pathParams: {
          userId: id,
        },
      })

      const retrievedUser2 = await userRepository.getUser(id)

      expect(retrievedUser).toBeDefined()
      expect(retrievedUser2).toBeNull()
    })
  })

  describe('PATCH /users/:userId', () => {
    it('resets cache after update', async () => {
      const token = await generateJwtToken(app.jwt, { userId: 1 }, 9999)
      const newUser = await userRepository.createUser(NEW_USER_FIXTURE)
      const { id } = newUser

      const updateResponse = await injectPatch(app, UserController.contracts.updateUser, {
        body: {
          name: 'updated',
        },
        pathParams: {
          userId: id,
        },
        headers: {
          authorization: `Bearer ${token}`,
        },
      })

      const retrievedUser2 = await userRepository.getUser(id)
      expect(updateResponse.statusCode).toBe(204)
      expect(retrievedUser2).toEqual({
        email: 'email@test.com',
        age: null,
        id,
        name: 'updated',
      })
    })
  })
})
