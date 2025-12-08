import type {
  FastifyInstance,
  FastifyPluginCallback,
  FastifyReply,
  FastifyRequest,
  HookHandlerDoneFunction,
} from 'fastify'
import fp from 'fastify-plugin'

export type JwtTokenPluginOptions = {
  skipList: Set<string>
}

function plugin(
  fastify: FastifyInstance,
  pluginOptions: JwtTokenPluginOptions,
  next: (err?: Error) => void,
) {
  fastify.addHook(
    'onRequest',
    (req: FastifyRequest, _res: FastifyReply, done: HookHandlerDoneFunction) => {
      if (req.routeOptions.url && pluginOptions.skipList.has(req.routeOptions.url)) {
        return done()
      }

      req
        .jwtVerify()
        .then(() => {
          done()
        })
        .catch((err) => {
          done(err)
        })
    },
  )

  next()
}

export const jwtTokenPlugin: FastifyPluginCallback<JwtTokenPluginOptions> =
  fp<JwtTokenPluginOptions>(plugin, {
    fastify: '5.x',
    name: 'jwt-token-plugin',
  })
