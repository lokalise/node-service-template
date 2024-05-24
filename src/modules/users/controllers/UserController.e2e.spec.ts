import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { DB_MODEL, cleanTables } from '../../../../test/DbCleaner.js'
import { getTestConfigurationOverrides } from '../../../../test/jwtUtils.js'
import type { AppInstance } from '../../../app.js'
import { getApp } from '../../../app.js'
import { generateJwtToken } from '../../../infrastructure/tokenUtils.js'
import type {
  CREATE_USER_BODY_SCHEMA_TYPE,
  GET_USER_SCHEMA_RESPONSE_SCHEMA_TYPE,
  UPDATE_USER_BODY_SCHEMA_TYPE,
} from '../schemas/userSchemas.js'

describe('UserController', () => {
  let app: AppInstance
  beforeAll(async () => {
    app = await getApp(getTestConfigurationOverrides())
  })
  beforeEach(async () => {
    await cleanTables(app.diContainer.cradle.prisma, [DB_MODEL.User])
  })
  afterAll(async () => {
    await app.close()
  })

  describe('POST /users', () => {
    it('validates email format', async () => {
      const token = await generateJwtToken(app.jwt, { userId: 1 }, 9999)
      const response = await app
        .inject()
        .post('/users')
        .headers({
          authorization: `Bearer ${token}`,
        })
        .body({ name: 'dummy', email: 'test' } as CREATE_USER_BODY_SCHEMA_TYPE)
        .end()

      expect(response.statusCode).toBe(400)
      expect(response.json()).toEqual(
        expect.objectContaining({
          details: {
            error: [
              {
                code: 'invalid_string',
                message: 'Invalid email',
                path: ['email'],
                validation: 'email',
              },
            ],
          },
          message: 'Invalid params',
        }),
      )
    })
  })

  describe('GET /users/:userId', () => {
    it('returns user when requested twice', async () => {
      const token = await generateJwtToken(app.jwt, { userId: '1' }, 9999)

      const response = await app
        .inject()
        .post('/users')
        .headers({
          authorization: `Bearer ${token}`,
        })
        .body({ name: 'dummy', email: 'email@test.com' } satisfies CREATE_USER_BODY_SCHEMA_TYPE)
        .end()
      expect(response.statusCode).toBe(201)
      const { id } = response.json<GET_USER_SCHEMA_RESPONSE_SCHEMA_TYPE>().data

      const response1 = await app
        .inject()
        .get(`/users/${id}`)
        .headers({
          authorization: `Bearer ${token}`,
        })
        .end()

      const response2 = await app
        .inject()
        .get(`/users/${id}`)
        .headers({
          authorization: `Bearer ${token}`,
        })
        .end()

      expect(response1.statusCode).toBe(200)
      expect(response2.statusCode).toBe(200)
      expect(response1.json()).toEqual(response.json())
      expect(response2.json()).toEqual(response.json())
    })
  })

  describe('DELETE /users/:userId', () => {
    it('resets cache after deletion', async () => {
      const token = await generateJwtToken(app.jwt, { userId: '1' }, 9999)

      const response = await app
        .inject()
        .post('/users')
        .headers({
          authorization: `Bearer ${token}`,
        })
        .body({ name: 'dummy', email: 'email@test.com' } as CREATE_USER_BODY_SCHEMA_TYPE)
        .end()
      expect(response.statusCode).toBe(201)
      const { id } = response.json<GET_USER_SCHEMA_RESPONSE_SCHEMA_TYPE>().data

      const response1 = await app
        .inject()
        .get(`/users/${id}`)
        .headers({
          authorization: `Bearer ${token}`,
        })
        .end()

      await app
        .inject()
        .delete(`/users/${id}`)
        .headers({
          authorization: `Bearer ${token}`,
        })
        .end()

      const response2 = await app
        .inject()
        .get(`/users/${id}`)
        .headers({
          authorization: `Bearer ${token}`,
        })
        .end()

      expect(response1.statusCode).toBe(200)
      expect(response2.statusCode).toBe(404)
      expect(response1.json()).toEqual(response.json())
    })
  })

  describe('PATCH /users/:userId', () => {
    it('resets cache after update', async () => {
      const token = await generateJwtToken(app.jwt, { userId: 1 }, 9999)

      const response = await app
        .inject()
        .post('/users')
        .headers({
          authorization: `Bearer ${token}`,
        })
        .body({ name: 'dummy', email: 'email@test.com' } as CREATE_USER_BODY_SCHEMA_TYPE)
        .end()
      expect(response.statusCode).toBe(201)
      const { id } = response.json<GET_USER_SCHEMA_RESPONSE_SCHEMA_TYPE>().data

      const response1 = await app
        .inject()
        .get(`/users/${id}`)
        .headers({
          authorization: `Bearer ${token}`,
        })
        .end()

      const updateResponse = await app
        .inject()
        .patch(`/users/${id}`)
        .body({
          name: 'updated',
        } satisfies UPDATE_USER_BODY_SCHEMA_TYPE)
        .headers({
          authorization: `Bearer ${token}`,
        })
        .end()

      const response2 = await app
        .inject()
        .get(`/users/${id}`)
        .headers({
          authorization: `Bearer ${token}`,
        })
        .end()

      expect(updateResponse.statusCode).toBe(204)
      expect(response1.statusCode).toBe(200)
      expect(response2.statusCode).toBe(200)
      expect(response2.json()).toEqual({
        data: {
          email: 'email@test.com',
          age: null,
          id: response1.json().data.id,
          name: 'updated',
        },
      })
    })
  })
})
