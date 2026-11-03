import { parseEnv } from 'envase'
import envSchema, { decodeJwtConfig, getProfilingConfig } from './config.ts'

describe('config', () => {
  describe('decodeJwtConfig', () => {
    it('replaces double pipe characters with newline', () => {
      const jwtPublicKey = 'key1||key2||key3'
      const expected = 'key1\nkey2\nkey3'
      expect(decodeJwtConfig(jwtPublicKey)).toEqual(expected)
    })

    it('returns the same string if there are no double pipe characters', () => {
      const jwtPublicKey = 'key1\nkey2\nkey3'
      expect(decodeJwtConfig(jwtPublicKey)).toEqual(jwtPublicKey)
    })

    it('returns an empty string if input is an empty string', () => {
      expect(decodeJwtConfig('')).toEqual('')
    })

    it('throws an error if input is not a string', () => {
      // @ts-expect-error
      expect(() => decodeJwtConfig(null)).toThrow(TypeError)
      // @ts-expect-error
      expect(() => decodeJwtConfig(undefined)).toThrow(TypeError)
    })
  })

  describe('gracefulShutdownTimeoutMs', () => {
    it('uses the default when not set', () => {
      const env = buildEnv({ GRACEFUL_SHUTDOWN_TIMEOUT_MS: undefined })
      const config = parseEnv(env, envSchema)
      expect(config.app.gracefulShutdownTimeoutMs).toBe(10000)
    })

    it('accepts values at or below 30000ms', () => {
      const env = buildEnv({ GRACEFUL_SHUTDOWN_TIMEOUT_MS: '30000' })
      const config = parseEnv(env, envSchema)
      expect(config.app.gracefulShutdownTimeoutMs).toBe(30000)
    })

    it('rejects values above 30000ms', () => {
      const env = buildEnv({ GRACEFUL_SHUTDOWN_TIMEOUT_MS: '60000' })
      expect(() => parseEnv(env, envSchema)).toThrowErrorMatchingInlineSnapshot(`
        [EnvaseError: Environment variables validation has failed:
          [GRACEFUL_SHUTDOWN_TIMEOUT_MS]:
            Too big: expected number to be <=30000
            (received: "60000")
        ]
      `)
    })
  })

  describe('OpenTelemetry config validation', () => {
    describe('_resourceAttributes', () => {
      it('accepts valid format with service name', () => {
        const env = buildEnv({
          OTEL_RESOURCE_ATTRIBUTES: 'service.name=my-app',
        })

        const config = parseEnv(env, envSchema)
        expect(config.vendors.opentelemetry._resourceAttributes).toBe('service.name=my-app')
      })

      it('accepts service names with hyphens and underscores', () => {
        const env = buildEnv({
          OTEL_RESOURCE_ATTRIBUTES: 'service.name=my-app_name-123',
        })

        const config = parseEnv(env, envSchema)
        expect(config.vendors.opentelemetry._resourceAttributes).toBe(
          'service.name=my-app_name-123',
        )
      })

      it('rejects format without service.name prefix', () => {
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

      it('rejects format with extra parameters', () => {
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

      it('rejects empty service name', () => {
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
      it('accepts valid URL', () => {
        const env = buildEnv({
          OTEL_EXPORTER_URL: 'https://otel-collector.example.com:4318',
        })

        const config = parseEnv(env, envSchema)
        expect(config.vendors.opentelemetry._exporterUrl).toBe(
          'https://otel-collector.example.com:4318',
        )
      })

      it('rejects invalid URL format', () => {
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

      it('rejects empty string', () => {
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

  describe('getProfilingConfig', () => {
    it('is disabled by default and files profiles under the service name', () => {
      expect(getProfilingConfig({ NODE_ENV: 'development' })).toMatchObject({
        isEnabled: false,
        appName: 'node-service-template',
        serverAddress: 'http://localhost:4040',
      })
    })

    it('is enabled outside of tests when PYROSCOPE_ENABLED is true', () => {
      expect(
        getProfilingConfig({
          NODE_ENV: 'development',
          PYROSCOPE_ENABLED: 'true',
          PYROSCOPE_SERVER_ADDRESS: 'http://localhost:4041',
        }),
      ).toMatchObject({ isEnabled: true, serverAddress: 'http://localhost:4041' })
    })

    it('stays disabled under NODE_ENV=test whatever PYROSCOPE_ENABLED says', () => {
      expect(getProfilingConfig({ NODE_ENV: 'test', PYROSCOPE_ENABLED: 'true' }).isEnabled).toBe(
        false,
      )
    })

    it('treats blank values as unset instead of failing', () => {
      expect(
        getProfilingConfig({
          NODE_ENV: 'development',
          PYROSCOPE_ENABLED: '',
          PYROSCOPE_SERVER_ADDRESS: '',
        }),
      ).toMatchObject({ isEnabled: false, serverAddress: 'http://localhost:4040' })
    })
  })
})

const buildEnv = (override: object) => ({
  ...process.env,
  ...override,
})
