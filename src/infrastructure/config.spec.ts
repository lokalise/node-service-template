import { globalLogger } from '@lokalise/node-core'
import { parseEnv } from 'envase'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
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

  describe('gracefulShutdownTimeoutMs', () => {
    let warnSpy: ReturnType<typeof vi.spyOn>

    beforeEach(() => {
      warnSpy = vi.spyOn(globalLogger, 'warn').mockImplementation(() => {})
    })

    afterEach(() => {
      warnSpy.mockRestore()
    })

    test('uses the default when not set', () => {
      const env = buildEnv({ GRACEFUL_SHUTDOWN_TIMEOUT_MS: undefined })
      const config = parseEnv(env, envSchema)
      expect(config.app.gracefulShutdownTimeoutMs).toBe(10000)
      expect(warnSpy).not.toHaveBeenCalled()
    })

    test('accepts values at or below 30000ms without warning', () => {
      const env = buildEnv({ GRACEFUL_SHUTDOWN_TIMEOUT_MS: '30000' })
      const config = parseEnv(env, envSchema)
      expect(config.app.gracefulShutdownTimeoutMs).toBe(30000)
      expect(warnSpy).not.toHaveBeenCalled()
    })

    test('clamps values above 30000ms to 30000ms and warns', () => {
      const env = buildEnv({ GRACEFUL_SHUTDOWN_TIMEOUT_MS: '60000' })
      const config = parseEnv(env, envSchema)
      expect(config.app.gracefulShutdownTimeoutMs).toBe(30000)
      expect(warnSpy).toHaveBeenCalledTimes(1)
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('60000'))
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('30000'))
    })
  })

  describe('OpenTelemetry config validation', () => {
    describe('_resourceAttributes', () => {
      test('accepts valid format with service name', () => {
        const env = buildEnv({
          OTEL_RESOURCE_ATTRIBUTES: 'service.name=my-app',
        })

        const config = parseEnv(env, envSchema)
        expect(config.vendors.opentelemetry._resourceAttributes).toBe('service.name=my-app')
      })

      test('accepts service names with hyphens and underscores', () => {
        const env = buildEnv({
          OTEL_RESOURCE_ATTRIBUTES: 'service.name=my-app_name-123',
        })

        const config = parseEnv(env, envSchema)
        expect(config.vendors.opentelemetry._resourceAttributes).toBe(
          'service.name=my-app_name-123',
        )
      })

      test('rejects format without service.name prefix', () => {
        const env = buildEnv({
          OTEL_RESOURCE_ATTRIBUTES: 'name=my-app',
        })

        expect(() => parseEnv(env, envSchema)).toThrowErrorMatchingInlineSnapshot(`
          [EnvaseError: Environment variables validation has failed:
            [OTEL_RESOURCE_ATTRIBUTES]:
              Must match format: service.name={serviceName}
              (received: "name=my-app")
          ]
        `)
      })

      test('rejects format with extra parameters', () => {
        const env = buildEnv({
          OTEL_RESOURCE_ATTRIBUTES: 'service.name=my-app,env=stage',
        })

        expect(() => parseEnv(env, envSchema)).toThrowErrorMatchingInlineSnapshot(`
          [EnvaseError: Environment variables validation has failed:
            [OTEL_RESOURCE_ATTRIBUTES]:
              Must match format: service.name={serviceName}
              (received: "service.name=my-app,env=stage")
          ]
        `)
      })

      test('rejects empty service name', () => {
        const env = buildEnv({
          OTEL_RESOURCE_ATTRIBUTES: 'service.name=',
        })

        expect(() => parseEnv(env, envSchema)).toThrowErrorMatchingInlineSnapshot(`
          [EnvaseError: Environment variables validation has failed:
            [OTEL_RESOURCE_ATTRIBUTES]:
              Must match format: service.name={serviceName}
              (received: "service.name=")
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
