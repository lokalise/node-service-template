/**
 * The markdown report `handleSummary` writes to `k6-report.md`: one row per journey, from the
 * tagged sub-metrics `buildThresholds` declares. The runner appends a `Resources` section to
 * the same file, with what the run cost the process and the database.
 *
 * No k6 imports, so it runs under vitest too.
 */

const formatMs = (value) => (typeof value === 'number' ? `${value.toFixed(1)} ms` : 'n/a')
const formatPercent = (value) =>
  typeof value === 'number' ? `${(value * 100).toFixed(2)}%` : 'n/a'

/** Whether every threshold declared on `metric` passed; undefined when it has none. */
function thresholdsPassed(metric) {
  const results = Object.values(metric?.thresholds ?? {})
  if (results.length === 0) return undefined
  return results.every((result) => result.ok)
}

const statusCell = (passed) => {
  if (passed === undefined) return ''
  return passed ? 'pass' : '**FAIL**'
}

export function journeyRows(data, journeys, budgets) {
  return journeys.map((journey) => {
    const duration = data.metrics[`http_req_duration{journey:${journey}}`]
    const failed = data.metrics[`http_req_failed{journey:${journey}}`]
    const values = duration?.values ?? {}
    const durationPassed = thresholdsPassed(duration)
    const failedPassed = thresholdsPassed(failed)
    const passed =
      durationPassed === undefined && failedPassed === undefined
        ? undefined
        : durationPassed !== false && failedPassed !== false

    return {
      journey,
      requests: values.count ?? 0,
      failed: failed?.values?.rate,
      med: values.med,
      p95: values['p(95)'],
      p99: values['p(99)'],
      max: values.max,
      budget: budgets[journey],
      passed,
    }
  })
}

/** The scenarios run concurrently, one per journey, so the total is VUs times journeys. */
export function loadDescription(load, journeys) {
  const total = load.vus * journeys.length
  const perJourney = journeys.length > 1 ? ` per journey, ${total} in total` : ''
  return `${load.vus} VUs${perJourney}, ${load.duration} hold`
}

export function markdownReport(data, { baseUrl, testType, load, journeys, budgets }) {
  const lines = [
    '# k6 report',
    '',
    `- Target: ${baseUrl}`,
    `- Test type: ${testType}${testType === 'smoke' ? '' : ` (${loadDescription(load, journeys)})`}`,
    `- Journeys: ${journeys.join(', ')}`,
    `- Checks passed: ${formatPercent(data.metrics.checks?.values?.rate)}`,
    '',
    '## Journeys',
    '',
    '| Journey | Requests | Failed | Median | p95 | p99 | Max | p95 budget | Thresholds |',
    '|---|---:|---:|---:|---:|---:|---:|---:|---|',
  ]

  for (const row of journeyRows(data, journeys, budgets)) {
    const budget = testType === 'smoke' ? 'n/a' : `${row.budget} ms`
    lines.push(
      `| ${row.journey} | ${row.requests} | ${formatPercent(row.failed)} | ${formatMs(row.med)} | ` +
        `${formatMs(row.p95)} | ${formatMs(row.p99)} | ${formatMs(row.max)} | ${budget} | ` +
        `${statusCell(row.passed)} |`,
    )
  }

  lines.push('')
  return lines.join('\n')
}
