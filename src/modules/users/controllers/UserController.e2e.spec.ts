import { describeContract } from '@lokalise/api-contracts'
import { injectDelete, injectGet, injectPatch, injectPost } from '@lokalise/fastify-api-contracts'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { cleanTables, DB_MODEL } from '../../../../test/DbCleaner.ts'
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

  describe(describeContract(UserController.contracts.createUser), () => {
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

  describe(describeContract(UserController.contracts.getUser), () => {
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

  describe(describeContract(UserController.contracts.deleteUser), () => {
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

  describe(describeContract(UserController.contracts.updateUser), () => {
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
