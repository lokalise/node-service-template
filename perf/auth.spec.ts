import { mkdtempSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createVerifier } from 'fast-jwt'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ensureKeyPair, readKeyPair, signToken } from './auth.ts'

describe('perf auth', () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'perf-auth-'))
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('generates a key pair once and reuses it afterwards', () => {
    const path = join(dir, 'nested', 'keys.json')

    const first = ensureKeyPair(path)
    const second = ensureKeyPair(path)

    expect(first.publicKey).toContain('BEGIN PUBLIC KEY')
    expect(second).toEqual(first)
    expect(readKeyPair(path)).toEqual(first)
    expect(statSync(path).mode & 0o777).toBe(0o600)
  })

  it('refuses to read a key pair nothing generated', () => {
    expect(() => readKeyPair(join(dir, 'missing.json'))).toThrow(/Bring the stack up first/)
  })

  it('signs a token the public key verifies', () => {
    const keys = ensureKeyPair(join(dir, 'keys.json'))

    const payload = createVerifier({ key: keys.publicKey })(signToken(keys))

    expect(payload).toMatchObject({ sub: 'perf-load-test' })
    expect(payload.exp).toBeGreaterThan(Date.now() / 1000)
  })
})
