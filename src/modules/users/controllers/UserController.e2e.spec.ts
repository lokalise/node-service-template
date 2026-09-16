import { randomUUID } from 'node:crypto'
import { describeApiContract } from '@lokalise/api-contracts'
import { injectByApiContract } from '@lokalise/fastify-api-contracts'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { cleanTables, DB_MODEL } from '../../../../test/DbCleaner.ts'
import { generateTestJwt, getTestConfigurationOverrides } from '../../../../test/jwtUtils.ts'
import type { AppInstance } from '../../../app.ts'
import { getApp } from '../../../app.ts'
import { API_SOURCE_HEADER } from '../../../plugins/publicApiSerializationPlugin.ts'
import type { UserRepository } from '../repositories/UserRepository.ts'
import type { UserCreateDTO } from '../services/UserService.ts'
import { UserController } from './UserController.ts'

const NEW_USER_FIXTURE = { name: 'dummy', email: 'email@test.com' } satisfies UserCreateDTO
const USER_WITH_AGE_FIXTURE = { name: 'dummy', email: 'email@test.com', age: 33 }

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
        headers: {
          authorization: `Bearer ${token}`,
        },
        body: { name: 'dummy', email: 'test' },
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
          internalMandatoryProp: expect.stringMatching(/^user:/),
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
        headers: {
          authorization: `Bearer ${token}`,
        },
        pathParams: {
          userId: id,
        },
      })

      const response2 = await injectByApiContract(app, UserController.contracts.getUser, {
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

    it('returns 404 with the contract error payload for an unknown user', async () => {
      const token = generateTestJwt({ userId: '1' })
      const unknownUserId = randomUUID()

      const response = await injectByApiContract(app, UserController.contracts.getUser, {
        headers: {
          authorization: `Bearer ${token}`,
        },
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

    it('returns internal-only fields to internal consumers', async () => {
      const token = generateTestJwt({ userId: 1 })
      const { id } = await userRepository.createUser(USER_WITH_AGE_FIXTURE)

      const headers = { authorization: `Bearer ${token}`, [API_SOURCE_HEADER]: 'internal' }
      const response = await injectByApiContract(app, UserController.contracts.getUser, {
        headers,
        pathParams: { userId: id },
      })

      expect(response.statusCode).toBe(200)
      expect(response.json().data).toEqual({
        id,
        name: 'dummy',
        email: 'email@test.com',
        age: 33,
        internalMandatoryProp: `user:${id}`,
        internalOptionalProp: 'age:33',
      })
    })

    it('strips internal-only fields for public consumers', async () => {
      const token = generateTestJwt({ userId: 1 })
      const { id } = await userRepository.createUser(USER_WITH_AGE_FIXTURE)

      const headers = { authorization: `Bearer ${token}`, [API_SOURCE_HEADER]: 'public' }
      const response = await injectByApiContract(app, UserController.contracts.getUser, {
        headers,
        pathParams: { userId: id },
      })

      expect(response.statusCode).toBe(200)
      expect(response.json().data).toEqual({
        id,
        name: 'dummy',
        email: 'email@test.com',
        age: 33,
      })
      expect(response.json().data).not.toHaveProperty('internalOptionalProp')
      // Required internal fields are stripped too: the public variant encodes against its own
      // schema, so requiredness never gets in the way.
      expect(response.json().data).not.toHaveProperty('internalMandatoryProp')
    })

    it('treats requests without the source header as internal (PoC default)', async () => {
      const token = generateTestJwt({ userId: 1 })
      const { id } = await userRepository.createUser(USER_WITH_AGE_FIXTURE)

      const response = await injectByApiContract(app, UserController.contracts.getUser, {
        headers: { authorization: `Bearer ${token}` },
        pathParams: { userId: id },
      })

      expect(response.statusCode).toBe(200)
      expect(response.json().data.age).toBe(33)
      expect(response.json().data.internalMandatoryProp).toBe(`user:${id}`)
    })
  })

  describe(describeApiContract(UserController.contracts.getUsersByIds), () => {
    it('batch-resolves users by their IDs', async () => {
      const token = generateTestJwt({ userId: 1 })
      const user1 = await userRepository.createUser(NEW_USER_FIXTURE)
      const user2 = await userRepository.createUser({
        name: 'second',
        email: 'second@test.com',
      })

      const response = await injectByApiContract(app, UserController.contracts.getUsersByIds, {
        headers: {
          authorization: `Bearer ${token}`,
        },
        body: {
          userIds: [user1.id, user2.id],
        },
      })

      expect(response.statusCode).toBe(200)
      const ids = response.json().data.map((user: { id: string }) => user.id)
      expect(ids).toEqual(expect.arrayContaining([user1.id, user2.id]))
    })

    it('rejects an empty list of IDs', async () => {
      const token = generateTestJwt({ userId: 1 })

      const response = await injectByApiContract(app, UserController.contracts.getUsersByIds, {
        headers: {
          authorization: `Bearer ${token}`,
        },
        body: {
          userIds: [],
        },
      })

      expect(response.statusCode).toBe(400)
    })

    it('strips internal-only fields inside arrays for public consumers', async () => {
      const token = generateTestJwt({ userId: 1 })
      const { id } = await userRepository.createUser(USER_WITH_AGE_FIXTURE)

      const headers = { authorization: `Bearer ${token}`, [API_SOURCE_HEADER]: 'public' }
      const response = await injectByApiContract(app, UserController.contracts.getUsersByIds, {
        headers,
        body: { userIds: [id] },
      })

      expect(response.statusCode).toBe(200)
      expect(response.json().data).toEqual([
        {
          id,
          name: 'dummy',
          email: 'email@test.com',
          age: 33,
        },
      ])
    })
  })

  describe(describeApiContract(UserController.contracts.deleteUser), () => {
    it('resets cache after deletion', async () => {
      const token = generateTestJwt({ userId: '1' })
      const newUser = await userRepository.createUser(NEW_USER_FIXTURE)
      const { id } = newUser

      const retrievedUser = await userRepository.getUser(id)

      await injectByApiContract(app, UserController.contracts.deleteUser, {
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

  describe('OpenAPI document', () => {
    it('hides internal-only user fields', async () => {
      const response = await app.inject({ method: 'GET', url: '/documentation/openapi.json' })

      expect(response.statusCode).toBe(200)
      const document = response.json()
      const userResponseSchema =
        document.paths['/users/{userId}'].get.responses['200'].content['application/json'].schema
      expect(Object.keys(userResponseSchema.properties.data.properties)).toEqual([
        'id',
        'name',
        'age',
        'email',
      ])
      // `internalMandatoryProp` is required in the Zod schema; the doc override must also
      // drop it from the JSON Schema `required` list, or the document would require a field
      // it never shows.
      expect(userResponseSchema.properties.data.required).toEqual(['id', 'name', 'email'])
      // The `visibility` marker itself must not leak into the published document.
      expect(JSON.stringify(document)).not.toContain('"visibility"')
      // Request schemas are untouched: the create-user body still documents `age`.
      const createUserBodySchema =
        document.paths['/users'].post.requestBody.content['application/json'].schema
      expect(Object.keys(createUserBodySchema.properties)).toContain('age')
    })
  })
})
