import { fastifyAwilixPlugin } from '@fastify/awilix'
import fastifyJWT from '@fastify/jwt'
import { InternalError } from '@lokalise/node-core'
import { asFunction } from 'awilix'
import type { FastifyInstance } from 'fastify'
import fastify from 'fastify'
import type { RouteHandlerMethod } from 'fastify/types/route'

import { getTestConfigurationOverrides } from '../../../test/jwtUtils'
import { jwtTokenPlugin } from '../../plugins/jwtTokenPlugin'

import { errorHandler } from './errorHandler'
import { AuthFailedError } from './publicErrors'

async function initApp(routeHandler: RouteHandlerMethod, awaitApp = true) {
  const app = fastify()
  void app.register(fastifyAwilixPlugin, { disposeOnClose: true })
  app.setErrorHandler(errorHandler)

  app.route({
    method: 'GET',
    url: '/',
    handler: routeHandler,
  })
  if (awaitApp) {
    await app.ready()

    app.diContainer.register(
      'errorReporter',
      asFunction(() => {
        return {
          // eslint-disable-next-line @typescript-eslint/no-empty-function
          report: () => {},
        }
      }),
    )
  }

  return app
}

describe('errorHandler', () => {
  let app: FastifyInstance
  afterAll(async () => {
    await app.close()
  })

  it('returns 500 internal error by default', async () => {
    app = await initApp(() => {
      throw new Error('Generic error')
    })

    const response = await app.inject().get('/').end()

    expect(response.statusCode).toBe(500)
    expect(response.json()).toEqual({
      errorCode: 'INTERNAL_SERVER_ERROR',
      message: 'Internal server error',
    })
  })

  it('responds with AUTH_FAILED in case of internal auth failed error', async () => {
    app = await initApp(() => {
      throw new AuthFailedError({ message: 'Auth failed', details: { someDetails: 'details' } })
    })

    const response = await app.inject().get('/').end()

    expect(response.statusCode).toBe(401)
    expect(response.json()).toEqual({
      message: 'Auth failed',
      errorCode: 'AUTH_FAILED',
      details: { someDetails: 'details' },
    })
  })

  it('returns 500 for InternalError', async () => {
    app = await initApp(() => {
      throw new InternalError({
        message: 'Auth failed',
        details: { userId: 4 },
        errorCode: 'INT_ERR',
      })
    })

    const response = await app.inject().get('/').end()

    expect(response.statusCode).toBe(500)
    expect(response.json()).toEqual({
      errorCode: 'INTERNAL_SERVER_ERROR',
      message: 'Internal server error',
    })
  })

  it('returns 401 for missing auth', async () => {
    app = await initApp(() => {
      // noop
    }, false)
    void app.register(fastifyJWT, {
      secret: 'dummy',
    })

    void app.register(jwtTokenPlugin, {
      skipList: new Set([]),
    })
    await app.ready()

    const response = await app.inject().get('/').end()

    expect(response.statusCode).toBe(401)
    expect(response.json()).toEqual({
      errorCode: 'AUTH_FAILED',
      message: 'No Authorization was found in request.headers',
    })
  })

  it('returns 401 for malformed JWT', async () => {
    app = await initApp(() => {
      // noop
    }, false)
    void app.register(fastifyJWT, {
      secret: 'dummy',
    })

    void app.register(jwtTokenPlugin, {
      skipList: new Set([]),
    })
    await app.ready()

    const response = await app
      .inject()
      .get('/')
      .headers({
        authorization: 'Bearer xyz',
      })
      .end()

    expect(response.statusCode).toBe(401)
    expect(response.json()).toEqual({
      errorCode: 'AUTH_FAILED',
      message: 'Authorization token is invalid',
    })
  })

  it('returns 401 for incorrect JWT', async () => {
    app = await initApp(() => {
      // noop
    }, false)
    const configOverrides = getTestConfigurationOverrides()
    void app.register(fastifyJWT, {
      secret: configOverrides.jwtKeys ?? 'dummy',
    })

    void app.register(jwtTokenPlugin, {
      skipList: new Set([]),
    })

    await app.ready()

    const response = await app
      .inject()
      .get('/')
      .headers({
        authorization:
          'Bearer eyJhbGciOiJSUzI1NiJ9.eyJleHAiOjE4MTYyMzkwMjJ9.m6fPGHqjDIonianPw0pFG3KEOqmkie7T1Ef-DjgiVuGch_eQYHAruw3_GBRJCgrx3ab0EfDj2f-gORfk0Z7HiiuAClakxdIlzsie-s7Hew9DCDC87IYXDvh0tngObILS66bsun9St9fp0ARFFQBhSLfMldjWJgDUH7-GyPUC9aHDvgReYtw9EOwn9NBK_3RT-VAGvzfndnOZt66ZKhnUD5uejNqkLy5E1E9zRinYjacdXwlkGO0AvUrHui0g9XFtndI_cpGVBLMu5n3CXG45mGP22ix27k3vyXuKPDXBAF9wHL94iTCfh7W2JzCRUEVFxrluWXf16RfWQlk-K-r_pnLuJqSm8AQMCFbKRSRh9Jyrmcpr03Kt8zmRtDrsk-0cnJl75aCo7Ynw6M2cDAatcyhyh_WX4bLTjfsINLOAK8fwJmLctkp_jOrb-jub-HqCCrH_chtiUZFMOZG81qjuOKjpFUYA6N1s-G0-tWEsNjEDTYjSIzRZ2oRvzuE9dynOdgyV0msh_SSLv7B4Dre8s0Hsfo9zK1bpiTIWSgZGmjD7upH1n9BnCcxYZ6vS6rBkHq1F1WGju9zmyzpr1bfpU6A7anrm8ASIKM8PlAlo4GWAOcMYQnsNhgqJw660lqlmAnZZDjcJsTO1jPL3Zu4xbdYYdoDQclxh_bpRtx92T-c',
      })
      .end()

    expect(response.statusCode).toBe(401)
    expect(response.json()).toEqual({
      errorCode: 'AUTH_FAILED',
      message: 'Authorization token is invalid',
    })
  })
})
