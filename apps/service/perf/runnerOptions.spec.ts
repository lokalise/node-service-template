import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SEED_USERS,
  parseOptions,
  resolveSeedUsers,
  retargetPerfEnv,
} from './runnerOptions.ts'

describe('parseOptions', () => {
  it('defaults to run with every step on and nothing kept', () => {
    const options = parseOptions([])

    expect(options.command).toBe('run')
    expect(options.flags).toEqual({
      keep: false,
      profiling: false,
      docker: true,
      migrate: true,
      probe: true,
      service: true,
      purgeProfiles: false,
    })
    expect(options.k6Mode).toBe('auto')
  })

  it('reads its own flags wherever they appear and hands the rest to k6', () => {
    const options = parseOptions([
      'run',
      '--',
      '-e',
      'JOURNEYS=get-user',
      '--profiling',
      '--keep',
      '--k6=docker',
      '--no-migrate',
    ])

    expect(options.flags.profiling).toBe(true)
    expect(options.flags.keep).toBe(true)
    expect(options.flags.migrate).toBe(false)
    expect(options.k6Mode).toBe('docker')
    expect(options.passthrough).toEqual(['-e', 'JOURNEYS=get-user'])
  })

  it('refuses an unknown command', () => {
    expect(() => parseOptions(['seed'])).toThrow(/unknown command "seed"/)
  })
})

describe('retargetPerfEnv', () => {
  const values = {
    APP_PORT: '3100',
    BASE_URL: 'http://localhost:3100',
    DATABASE_URL: 'postgresql://serviceuser:pass@localhost:5452/service_db_perf',
    REDIS_PORT: '6380',
    PYROSCOPE_SERVER_ADDRESS: 'http://localhost:4041',
  }

  it('leaves the file alone when no port is overridden', () => {
    expect(retargetPerfEnv(values, {})).toEqual(values)
  })

  it('moves every address that names an overridden port', () => {
    const retargeted = retargetPerfEnv(values, {
      PERF_SERVICE_PORT: '3200',
      PERF_POSTGRES_PORT: '6000',
      PERF_REDIS_PORT: '7000',
      PERF_PYROSCOPE_PORT: '4999',
    })

    expect(retargeted).toEqual({
      APP_PORT: '3200',
      BASE_URL: 'http://localhost:3200',
      DATABASE_URL: 'postgresql://serviceuser:pass@localhost:6000/service_db_perf',
      REDIS_PORT: '7000',
      PYROSCOPE_SERVER_ADDRESS: 'http://localhost:4999',
    })
  })
})

describe('resolveSeedUsers', () => {
  it('reads SEED_USERS from the k6 arguments in any -e form', () => {
    expect(resolveSeedUsers([])).toBe(DEFAULT_SEED_USERS)
    expect(resolveSeedUsers(['-e', 'JOURNEYS=get-user'])).toBe(DEFAULT_SEED_USERS)
    expect(resolveSeedUsers(['-e', 'SEED_USERS=20'])).toBe(20)
    expect(resolveSeedUsers(['--env', 'SEED_USERS=30'])).toBe(30)
    expect(resolveSeedUsers(['--env=SEED_USERS=40'])).toBe(40)
  })

  it('refuses anything but a positive integer', () => {
    for (const bad of ['0', 'abc', '1e2x', '-5']) {
      expect(() => resolveSeedUsers(['-e', `SEED_USERS=${bad}`])).toThrow(
        /SEED_USERS must be a positive integer/,
      )
    }
  })
})
