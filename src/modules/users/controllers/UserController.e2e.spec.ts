import type { FastifyInstance } from 'fastify'

import { getTestConfigurationOverrides } from '../../../../test/jwtUtils'
import { getApp } from '../../../app'
import { generateJwtToken } from '../../../infrastructure/tokenUtils'
import type { CREATE_USER_SCHEMA_TYPE } from '../../../schemas/userSchemas'

describe('UserController', () => {
  describe('POST /users', () => {
    let app: FastifyInstance
    beforeAll(async () => {
      app = await getApp(getTestConfigurationOverrides())
    })

    afterAll(async () => {
      await app.close()
    })

    it('validates email format', async () => {
      const token = await generateJwtToken(app.jwt, { userId: 1 }, 9999)
      const response = await app
        .inject()
        .post('/users')
        .headers({
          authorization: `Bearer ${token}`,
        })
        .body({ name: 'dummy', email: 'test' } as CREATE_USER_SCHEMA_TYPE)
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
})
