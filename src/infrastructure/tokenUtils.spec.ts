import fastifyJWT from '@fastify/jwt'
import fastify from 'fastify'
import { describe, expect, it } from 'vitest'
import { generateTestJwt, getTestConfigurationOverrides } from '../../test/jwtUtils.ts'
import { decodeJwtToken } from './tokenUtils.ts'

type Token = {
  exp: number
  iat: number
}

describe('tokenUtils', () => {
  describe('generateJwtToken', () => {
    it('successfully generate jwt token', async () => {
      const app = fastify()
      void app.register(fastifyJWT, {
        secret: {
          public: getTestConfigurationOverrides().jwtKeys.public,
        },
      })
      await app.ready()

      const payload = {
        userId: 1,
      }

      const token = generateTestJwt(payload)
      const decodedToken = await decodeJwtToken<Token>(app.jwt, token)

      expect(decodedToken).toMatchObject({
        userId: 1,
        iat: expect.any(Number),
      })

      await app.close()
    })
  })
})
