import { parseEnv } from 'envase'
import { describe, expect, test } from 'vitest'
import envSchema, { decodeJwtConfig } from './config.ts'

describe('config', () => {
  describe('decodeJwtConfig', () => {
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
  })

  describe('OpenTelemetry config validation', () => {
    describe('_resourceAttributes', () => {
      test('accepts valid format with stage env', () => {
        const env = buildEnv({
          OTEL_RESOURCE_ATTRIBUTES: 'service.namespace=my-app,env=stage',
        })

        const config = parseEnv(env, envSchema)
        expect(config.vendors.opentelemetry._resourceAttributes).toBe(
          'service.namespace=my-app,env=stage',
        )
      })

      test('accepts valid format with live env', () => {
        const env = buildEnv({
          OTEL_RESOURCE_ATTRIBUTES: 'service.namespace=another-service,env=live',
        })

        const config = parseEnv(env, envSchema)
        expect(config.vendors.opentelemetry._resourceAttributes).toBe(
          'service.namespace=another-service,env=live',
        )
      })

      test('accepts format with reversed order', () => {
        const env = buildEnv({
          OTEL_RESOURCE_ATTRIBUTES: 'env=stage,service.namespace=my-app',
        })

        const config = parseEnv(env, envSchema)
        expect(config.vendors.opentelemetry._resourceAttributes).toBe(
          'env=stage,service.namespace=my-app',
        )
      })

      test('accepts app names with hyphens and underscores', () => {
        const env = buildEnv({
          OTEL_RESOURCE_ATTRIBUTES: 'service.namespace=my-app_name-123,env=stage',
        })

        const config = parseEnv(env, envSchema)
        expect(config.vendors.opentelemetry._resourceAttributes).toBe(
          'service.namespace=my-app_name-123,env=stage',
        )
      })

      test('rejects format with invalid env value', () => {
        const env = buildEnv({
          OTEL_RESOURCE_ATTRIBUTES: 'service.namespace=my-app,env=production',
        })

        expect(() => parseEnv(env, envSchema)).toThrowErrorMatchingInlineSnapshot(`
          [EnvaseError: Environment variables validation has failed:
            [OTEL_RESOURCE_ATTRIBUTES]:
              Must match format: service.namespace={appName},env={stage or live} or env={stage or live},service.namespace={appName}
              (received: "service.namespace=my-app,env=production")
          ]
        `)
      })

      test('rejects format without service.namespace prefix', () => {
        const env = buildEnv({
          OTEL_RESOURCE_ATTRIBUTES: 'namespace=my-app,env=stage',
        })

        expect(() => parseEnv(env, envSchema)).toThrowErrorMatchingInlineSnapshot(`
          [EnvaseError: Environment variables validation has failed:
            [OTEL_RESOURCE_ATTRIBUTES]:
              Must match format: service.namespace={appName},env={stage or live} or env={stage or live},service.namespace={appName}
              (received: "namespace=my-app,env=stage")
          ]
        `)
      })

      test('rejects format with missing env parameter', () => {
        const env = buildEnv({
          OTEL_RESOURCE_ATTRIBUTES: 'service.namespace=my-app',
        })

        expect(() => parseEnv(env, envSchema)).toThrowErrorMatchingInlineSnapshot(`
          [EnvaseError: Environment variables validation has failed:
            [OTEL_RESOURCE_ATTRIBUTES]:
              Must match format: service.namespace={appName},env={stage or live} or env={stage or live},service.namespace={appName}
              (received: "service.namespace=my-app")
          ]
        `)
      })

      test('rejects format with extra parameters', () => {
        const env = buildEnv({
          OTEL_RESOURCE_ATTRIBUTES: 'service.namespace=my-app,env=stage,extra=value',
        })

        expect(() => parseEnv(env, envSchema)).toThrowErrorMatchingInlineSnapshot(`
          [EnvaseError: Environment variables validation has failed:
            [OTEL_RESOURCE_ATTRIBUTES]:
              Must match format: service.namespace={appName},env={stage or live} or env={stage or live},service.namespace={appName}
              (received: "service.namespace=my-app,env=stage,extra=value")
          ]
        `)
      })

      test('rejects empty app name', () => {
        const env = buildEnv({
          OTEL_RESOURCE_ATTRIBUTES: 'service.namespace=,env=stage',
        })

        expect(() => parseEnv(env, envSchema)).toThrowErrorMatchingInlineSnapshot(`
          [EnvaseError: Environment variables validation has failed:
            [OTEL_RESOURCE_ATTRIBUTES]:
              Must match format: service.namespace={appName},env={stage or live} or env={stage or live},service.namespace={appName}
              (received: "service.namespace=,env=stage")
          ]
        `)
      })
    })

    describe('_exporterUrl', () => {
      test('accepts valid URL', () => {
        const env = buildEnv({
          OTEL_EXPORTER_URL: 'https://otel-collector.example.com:4318',
        })

        const config = parseEnv(env, envSchema)
        expect(config.vendors.opentelemetry._exporterUrl).toBe(
          'https://otel-collector.example.com:4318',
        )
      })

      test('rejects invalid URL format', () => {
        const env = buildEnv({
          OTEL_EXPORTER_URL: 'not-a-url',
        })

        expect(() => parseEnv(env, envSchema)).toThrowErrorMatchingInlineSnapshot(`
          [EnvaseError: Environment variables validation has failed:
            [OTEL_EXPORTER_URL]:
              Invalid URL
              (received: "not-a-url")
          ]
        `)
      })

      test('rejects empty string', () => {
        const env = buildEnv({
          OTEL_EXPORTER_URL: '',
        })

        expect(() => parseEnv(env, envSchema)).toThrowErrorMatchingInlineSnapshot(`
          [EnvaseError: Environment variables validation has failed:
            [OTEL_EXPORTER_URL]:
              Invalid URL
              (received: "")
          ]
        `)
      })
    })
  })
})

const buildEnv = (override: object) => ({
  ...process.env,
  ...override,
})
