import { readFileSync } from 'node:fs'
import path from 'node:path'

import type { ConfigOverrides } from '../src/app.ts'

const getPublicKey = (): Buffer =>
  readFileSync(path.resolve(__dirname, './keys/jwtRS256-testing.key.pub'))

export const getTestConfigurationOverrides = (): ConfigOverrides => {
  return {
    jwtKeys: {
      public: getPublicKey(),
    },
  }
}
