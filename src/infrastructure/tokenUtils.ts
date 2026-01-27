import type { JWT } from '@fastify/jwt'

import { AuthFailedError, EmptyTokenError } from './errors/publicErrors.ts'

const hasCode = (error: unknown): error is { code: unknown } =>
  typeof error === 'object' && error !== null && 'code' in error

export function decodeJwtToken<T>(jwt: JWT, encodedToken: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    jwt.verify(encodedToken, (err: Error | null, decoded: T) => {
      if (err) {
        return reject(err)
      }
      if (!decoded) {
        throw new EmptyTokenError()
      }
      resolve(decoded as T)
    })
  }).catch((err) => {
    if (hasCode(err) && err.code === 'FAST_JWT_INVALID_SIGNATURE') {
      throw new AuthFailedError({ message: 'Auth error' })
    }
    throw err
  })
}
