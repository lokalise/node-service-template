import type {
  FastifyInstance,
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

export const jwtTokenPlugin = fp<JwtTokenPluginOptions>(plugin, {
  fastify: '4.x',
  name: 'jwt-token-plugin',
})
