import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { injectGet, injectPatch, injectPost } from '@lokalise/fastify-api-contracts'
import { DB_MODEL, cleanTables } from '../../../../test/DbCleaner.js'
import { getTestConfigurationOverrides } from '../../../../test/jwtUtils.js'
import type { AppInstance } from '../../../app.js'
import { getApp } from '../../../app.js'
import { generateJwtToken } from '../../../infrastructure/tokenUtils.js'
import {
  getUserContract,
  patchUpdateUserContract,
  postCreateUserContract,
} from '../schemas/userApiContracts.js'

describe('UserController', () => {
  let app: AppInstance
  beforeAll(async () => {
    app = await getApp(getTestConfigurationOverrides())
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
      const response = await injectPost(app, postCreateUserContract, {
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
  })

  describe('GET /users/:userId', () => {
    it('returns user when requested twice', async () => {
      const token = await generateJwtToken(app.jwt, { userId: '1' }, 9999)

      const response = await injectPost(app, postCreateUserContract, {
        headers: {
          authorization: `Bearer ${token}`,
        },
        body: { name: 'dummy', email: 'email@test.com' },
      })

      expect(response.statusCode).toBe(201)
      const { id } = response.json().data

      const response1 = await injectGet(app, getUserContract, {
        headers: {
          authorization: `Bearer ${token}`,
        },
        pathParams: {
          userId: id,
        },
      })

      const response2 = await injectGet(app, getUserContract, {
        headers: {
          authorization: `Bearer ${token}`,
        },
        pathParams: {
          userId: id,
        },
      })

      expect(response1.statusCode).toBe(200)
      expect(response2.statusCode).toBe(200)
      expect(response1.json()).toEqual(response.json())
      expect(response2.json()).toEqual(response.json())
    })
  })

  describe('DELETE /users/:userId', () => {
    it('resets cache after deletion', async () => {
      const token = await generateJwtToken(app.jwt, { userId: '1' }, 9999)

      const response = await injectPost(app, postCreateUserContract, {
        headers: {
          authorization: `Bearer ${token}`,
        },
        body: { name: 'dummy', email: 'email@test.com' },
      })

      expect(response.statusCode).toBe(201)
      const { id } = response.json().data

      const response1 = await injectGet(app, getUserContract, {
        headers: {
          authorization: `Bearer ${token}`,
        },
        pathParams: {
          userId: id,
        },
      })

      await app
        .inject()
        .delete(`/users/${id}`)
        .headers({
          authorization: `Bearer ${token}`,
        })
        .end()

      const response2 = await injectGet(app, getUserContract, {
        headers: {
          authorization: `Bearer ${token}`,
        },
        pathParams: {
          userId: id,
        },
      })

      expect(response1.statusCode).toBe(200)
      expect(response2.statusCode).toBe(404)
      expect(response1.json()).toEqual(response.json())
    })
  })

  describe('PATCH /users/:userId', () => {
    it('resets cache after update', async () => {
      const token = await generateJwtToken(app.jwt, { userId: 1 }, 9999)

      const response = await injectPost(app, postCreateUserContract, {
        headers: {
          authorization: `Bearer ${token}`,
        },
        body: { name: 'dummy', email: 'email@test.com' },
      })

      expect(response.statusCode).toBe(201)
      const { id } = response.json().data

      const response1 = await injectGet(app, getUserContract, {
        headers: {
          authorization: `Bearer ${token}`,
        },
        pathParams: {
          userId: id,
        },
      })

      const updateResponse = await injectPatch(app, patchUpdateUserContract, {
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

      const response2 = await injectGet(app, getUserContract, {
        headers: {
          authorization: `Bearer ${token}`,
        },
        pathParams: {
          userId: id,
        },
      })

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
