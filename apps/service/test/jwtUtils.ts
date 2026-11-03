import { readFileSync } from 'node:fs'
import path from 'node:path'
import { createSigner } from 'fast-jwt'
import type { ConfigOverrides } from '../src/app.ts'

const getPrivateKey = (): Buffer =>
  readFileSync(path.resolve(__dirname, './keys/jwtRS256-testing.key'))
const getPublicKey = (): Buffer =>
  readFileSync(path.resolve(__dirname, './keys/jwtRS256-testing.key.pub'))

const signer = createSigner({ algorithm: 'RS256', key: getPrivateKey() })

export const generateTestJwt = (payload: Record<string, unknown>): string => {
  return signer(payload)
}

export const getTestConfigurationOverrides = () => {
  return {
    jwtKeys: {
      public: getPublicKey(),
    },
  } satisfies ConfigOverrides
}
