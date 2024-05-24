import fastifyJWT from '@fastify/jwt'
import fastify from 'fastify'
import { describe, expect, it } from 'vitest'
const ACCESS_TOKEN_TTL_IN_SECONDS = 60

import { decodeJwtToken, generateJwtToken } from './tokenUtils.js'

type Token = {
  exp: number
  iat: number
}

describe('tokenUtils', () => {
  describe('generateJwtToken', () => {
    it('successfully generate jwt token', async () => {
      const app = fastify()
      void app.register(fastifyJWT, {
        secret: 'secret',
      })
      await app.ready()

      const payload = {
        userId: 1,
      }

      const token = await generateJwtToken(app.jwt, payload, ACCESS_TOKEN_TTL_IN_SECONDS)
      const decodedToken = await decodeJwtToken<Token>(app.jwt, token)

      expect(decodedToken).toMatchObject({
        userId: 1,
        exp: expect.any(Number),
        iat: expect.any(Number),
      })
      expect(decodedToken.exp - decodedToken.iat).toEqual(ACCESS_TOKEN_TTL_IN_SECONDS)

      await app.close()
    })

    it('unsuccessfully decrypt jwt token', async () => {
      const app = fastify()
      void app.register(fastifyJWT, {
        secret: 'secret',
      })
      await app.ready()

      const app2 = fastify()
      void app2.register(fastifyJWT, {
        secret: 'secret2',
      })
      await app2.ready()

      const payload = {
        userId: 1,
      }

      const token = await generateJwtToken(app.jwt, payload, ACCESS_TOKEN_TTL_IN_SECONDS)

      await expect(() => {
        return decodeJwtToken(app2.jwt, token)
      }).rejects.toThrow('Auth error')

      await app.close()
      await app2.close()
    })
  })
})
