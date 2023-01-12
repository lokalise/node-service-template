import { readFileSync } from 'fs'
import path from 'path'

import type { ConfigOverrides } from '../src/app'

const getPrivateKey = (): Buffer =>
  readFileSync(path.resolve(__dirname, './keys/jwtRS256-testing.key'))
const getPublicKey = (): Buffer =>
  readFileSync(path.resolve(__dirname, './keys/jwtRS256-testing.key.pub'))

export const getTestConfigurationOverrides = (): ConfigOverrides => {
  return {
    jwtKeys: {
      private: getPrivateKey(),
      public: getPublicKey(),
    },
  }
}
