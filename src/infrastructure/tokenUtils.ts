import type { JWT } from '@fastify/jwt'

import { AuthFailedError, EmptyTokenError } from './errors/publicErrors.ts'

export function generateJwtToken(
  jwt: JWT,
  payload: Record<string, unknown>,
  ttlInSeconds: number,
): Promise<string> {
  return new Promise((resolve, reject) => {
    jwt.sign(payload, { expiresIn: ttlInSeconds }, (err, encoded) => {
      if (err) {
        return reject(err)
      }
      if (!encoded) {
        throw new EmptyTokenError()
      }
      resolve(encoded)
    })
  })
}

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
