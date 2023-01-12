import type {
  FastifyReply,
  FastifyRequest,
  FastifyInstance,
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
    (req: FastifyRequest, res: FastifyReply, done: HookHandlerDoneFunction) => {
      if (pluginOptions.skipList.has(req.routerPath)) {
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
