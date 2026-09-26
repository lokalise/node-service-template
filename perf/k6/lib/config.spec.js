import { describe, expect, it } from 'vitest'
import {
  buildScenarios,
  buildThresholds,
  resolveBaseUrl,
  resolveJourneys,
  resolveLoad,
  resolvePositiveInteger,
  resolveTestType,
  resolveUserIds,
} from './config.js'

describe('k6 config', () => {
  describe('resolveBaseUrl', () => {
    it.each([
      'http://localhost:3100',
      'http://127.0.0.1:3100/',
      'http://host.docker.internal:3100',
    ])('accepts the loopback target %s', (baseUrl) => {
      expect(resolveBaseUrl({ BASE_URL: baseUrl })).toBe(baseUrl.replace(/\/$/, ''))
    })

    it.each(['https://api.example.com', 'http://localhost.example.com:3100'])(
      'refuses %s',
      (baseUrl) => {
        expect(() => resolveBaseUrl({ BASE_URL: baseUrl })).toThrow(/loopback/)
      },
    )
  })

  describe('resolveTestType', () => {
    it('defaults to average-load and refuses an unknown profile', () => {
      expect(resolveTestType({})).toBe('average-load')
      expect(() => resolveTestType({ TEST_TYPE: 'soak' })).toThrow(/TEST_TYPE must be one of/)
    })
  })

  describe('resolveJourneys', () => {
    it('selects every journey when JOURNEYS is unset', () => {
      expect(resolveJourneys({})).toEqual(['get-user', 'get-users-by-ids', 'user-lifecycle'])
    })

    it('selects the named journeys and refuses unknown ones', () => {
      expect(resolveJourneys({ JOURNEYS: ' get-user, user-lifecycle ' })).toEqual([
        'get-user',
        'user-lifecycle',
      ])
      expect(() => resolveJourneys({ JOURNEYS: 'get-user,upload' })).toThrow(/unknown journey/)
    })
  })

  describe('resolveLoad', () => {
    it('takes the profile unless VUS or DURATION override it', () => {
      expect(resolveLoad({}, 'stress')).toEqual({ vus: 20, duration: '3m' })
      expect(resolveLoad({ VUS: '8', DURATION: '30s' }, 'stress')).toEqual({
        vus: 8,
        duration: '30s',
      })
      expect(() => resolveLoad({ VUS: '0' }, 'stress')).toThrow(/VUS/)
    })
  })

  describe('resolvePositiveInteger', () => {
    it('falls back when unset and refuses anything but a positive integer', () => {
      expect(resolvePositiveInteger({}, 'BATCH_SIZE', 10)).toBe(10)
      expect(resolvePositiveInteger({ BATCH_SIZE: '' }, 'BATCH_SIZE', 10)).toBe(10)
      expect(resolvePositiveInteger({ BATCH_SIZE: '25' }, 'BATCH_SIZE', 10)).toBe(25)
      for (const bad of ['0', '-1', 'abc', '1.5', '1e2x']) {
        expect(() => resolvePositiveInteger({ BATCH_SIZE: bad }, 'BATCH_SIZE', 10)).toThrow(
          /BATCH_SIZE must be a positive integer/,
        )
      }
    })
  })

  describe('resolveUserIds', () => {
    it('refuses a read journey with no seeded users to pick from', () => {
      expect(() => resolveUserIds(['get-user'], undefined)).toThrow(/no seeded users/)
      expect(() => resolveUserIds(['get-users-by-ids'], [])).toThrow(/no seeded users/)
    })

    it('lets the write journey run without seeded users', () => {
      expect(resolveUserIds(['user-lifecycle'], undefined)).toEqual([])
      expect(resolveUserIds(['get-user'], ['a', 'b'])).toEqual(['a', 'b'])
    })
  })

  describe('buildScenarios', () => {
    it('runs a smoke as one iteration of every journey', () => {
      expect(buildScenarios('smoke', ['get-user'], { vus: 1, duration: '0s' })).toEqual({
        smoke: { executor: 'shared-iterations', vus: 1, iterations: 1, exec: 'allJourneys' },
      })
    })

    it('gives each journey its own ramping scenario under load', () => {
      const scenarios = buildScenarios('average-load', ['get-user', 'user-lifecycle'], {
        vus: 5,
        duration: '60s',
      })

      expect(Object.keys(scenarios)).toEqual(['get_user', 'user_lifecycle'])
      expect(scenarios.get_user).toMatchObject({
        executor: 'ramping-vus',
        exec: 'getUserJourney',
        stages: [
          { duration: '10s', target: 5 },
          { duration: '60s', target: 5 },
          { duration: '10s', target: 0 },
        ],
      })
    })
  })

  describe('buildThresholds', () => {
    it('holds latency budgets under load', () => {
      expect(buildThresholds('average-load', ['get-user'])).toEqual({
        checks: ['rate>0.99'],
        'http_req_failed{journey:get-user}': ['rate<0.01'],
        'http_req_duration{journey:get-user}': ['p(95)<50'],
      })
    })

    it('holds a smoke to failures only', () => {
      expect(buildThresholds('smoke', ['get-user'])).toMatchObject({
        'http_req_duration{journey:get-user}': ['max>=0'],
      })
    })
  })
})
