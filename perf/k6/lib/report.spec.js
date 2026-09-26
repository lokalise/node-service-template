import { describe, expect, it } from 'vitest'
import { markdownReport } from './report.js'

const summary = {
  metrics: {
    checks: { values: { rate: 1 } },
    'http_req_duration{journey:get-user}': {
      values: { count: 1200, med: 2.5, 'p(95)': 6.25, 'p(99)': 9.1, max: 30 },
      thresholds: { 'p(95)<50': { ok: true } },
    },
    'http_req_failed{journey:get-user}': {
      values: { rate: 0 },
      thresholds: { 'rate<0.01': { ok: true } },
    },
    'http_req_duration{journey:user-lifecycle}': {
      values: { count: 400, med: 40, 'p(95)': 120, 'p(99)': 150, max: 200 },
      thresholds: { 'p(95)<100': { ok: false } },
    },
    'http_req_failed{journey:user-lifecycle}': {
      values: { rate: 0.005 },
      thresholds: { 'rate<0.01': { ok: true } },
    },
  },
}

describe('markdownReport', () => {
  it('renders one row per journey with its budget and outcome', () => {
    const report = markdownReport(summary, {
      baseUrl: 'http://localhost:3100',
      testType: 'average-load',
      load: { vus: 5, duration: '60s' },
      journeys: ['get-user', 'user-lifecycle'],
      budgets: { 'get-user': 50, 'user-lifecycle': 100 },
    })

    expect(report).toContain('- Test type: average-load (5 VUs, 60s hold)')
    expect(report).toContain('- Checks passed: 100.00%')
    expect(report).toContain(
      '| get-user | 1200 | 0.00% | 2.5 ms | 6.3 ms | 9.1 ms | 30.0 ms | 50 ms | pass |',
    )
    expect(report).toContain(
      '| user-lifecycle | 400 | 0.50% | 40.0 ms | 120.0 ms | 150.0 ms | 200.0 ms | 100 ms | **FAIL** |',
    )
  })

  it('says n/a for a journey that made no requests and for budgets in a smoke', () => {
    const report = markdownReport(
      { metrics: {} },
      {
        baseUrl: 'http://localhost:3100',
        testType: 'smoke',
        load: { vus: 1, duration: '0s' },
        journeys: ['get-user'],
        budgets: { 'get-user': 50 },
      },
    )

    expect(report).toContain('- Test type: smoke\n')
    expect(report).toContain('| get-user | 0 | n/a | n/a | n/a | n/a | n/a | n/a |  |')
  })
})
