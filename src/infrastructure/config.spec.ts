import { expect, test } from 'vitest'
import { decodeJwtConfig } from './config.ts'

test('replaces double pipe characters with newline', () => {
  const jwtPublicKey = 'key1||key2||key3'
  const expected = 'key1\nkey2\nkey3'
  expect(decodeJwtConfig(jwtPublicKey)).toEqual(expected)
})

test('returns the same string if there are no double pipe characters', () => {
  const jwtPublicKey = 'key1\nkey2\nkey3'
  expect(decodeJwtConfig(jwtPublicKey)).toEqual(jwtPublicKey)
})

test('returns an empty string if input is an empty string', () => {
  expect(decodeJwtConfig('')).toEqual('')
})

test('throws an error if input is not a string', () => {
  // @ts-expect-error
  expect(() => decodeJwtConfig(null)).toThrow(TypeError)
  // @ts-expect-error
  expect(() => decodeJwtConfig(undefined)).toThrow(TypeError)
})
