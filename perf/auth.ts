/**
 * The JWT a load run authenticates with.
 *
 * Every route but the health checks requires a JWT the service verifies against
 * `JWT_PUBLIC_KEY`. Rather than depend on `scripts/keys/` (which is gitignored and may not
 * exist), the runner generates a key pair of its own on the first bring-up, keeps it in
 * `perf/.auth/`, gives the public half to the service and signs a token for k6 with the
 * private half. A `k6` against a stack another terminal brought up reads the same pair.
 */
import { generateKeyPairSync } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { createSigner } from 'fast-jwt'

export type PerfKeyPair = {
  publicKey: string
  privateKey: string
}

export function generateKeyPair(): PerfKeyPair {
  return generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  })
}

/** The key pair stored at `path`, generated and stored there first if there is none. */
export function ensureKeyPair(path: string): PerfKeyPair {
  if (existsSync(path)) {
    return JSON.parse(readFileSync(path, 'utf8')) as PerfKeyPair
  }
  const keys = generateKeyPair()
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, JSON.stringify(keys, null, 2), { mode: 0o600 })
  return keys
}

/**
 * The key pair stored at `path`, for a command that runs against a stack it did not bring
 * up and therefore must not invent a key the running service does not know.
 */
export function readKeyPair(path: string): PerfKeyPair {
  if (!existsSync(path)) {
    throw new Error(
      `no key pair at ${path}. Bring the stack up first: node --run perf:up (or perf:run -- --keep)`,
    )
  }
  return JSON.parse(readFileSync(path, 'utf8')) as PerfKeyPair
}

/** A token the service accepts, valid for a day: long enough for any run, short enough to not linger. */
export function signToken(keys: PerfKeyPair): string {
  const sign = createSigner({ algorithm: 'RS256', key: keys.privateKey, expiresIn: 86_400_000 })
  return sign({ sub: 'perf-load-test' })
}
