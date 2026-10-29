/**
 * Load profiles, journey selection, scenarios and thresholds for the k6 script.
 *
 * Plain functions of the environment rather than module-level reads of `__ENV`, so they run
 * under vitest as well as k6: nothing here imports a k6 module.
 */

/** The journeys the script offers: `JOURNEYS=` name to the exported function k6 runs. */
export const JOURNEYS = {
  'get-user': 'getUserJourney',
  'get-users-by-ids': 'getUsersByIdsJourney',
  'user-lifecycle': 'userLifecycleJourney',
}

/**
 * Per-request p95 budgets in milliseconds, by journey. Local numbers for a host process
 * against containers on loopback: loose enough to pass on a laptop, tight enough that an
 * N+1 query or a missing index fails them. Tune them for your own service.
 */
export const P95_BUDGETS_MS = {
  'get-user': 50,
  'get-users-by-ids': 75,
  'user-lifecycle': 100,
}

export const PROFILES = {
  // One pass of every selected journey: does it work at all. Runs as a single iteration,
  // so neither number applies.
  smoke: { vus: 1, duration: '0s' },
  // A steady load a laptop sustains. Long enough for several profile windows at the
  // 15s flush interval perf.env sets.
  'average-load': { vus: 5, duration: '60s' },
  // Past the comfortable point, to see what saturates first.
  stress: { vus: 20, duration: '3m' },
}

/** How long the ramping scenarios take to reach, and to leave, their VU target. */
export const RAMP_DURATION = '10s'

/**
 * Hosts the script will send load to. A load test pointed at a shared environment by a
 * stray BASE_URL is an incident; `host.docker.internal` is what a containerised k6 reaches
 * the host through.
 */
const LOCAL_HOST_PATTERN =
  /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\]|host\.docker\.internal)(:\d+)?(\/|$)/

export function resolveBaseUrl(env) {
  const baseUrl = (env.BASE_URL || 'http://localhost:3100').replace(/\/+$/, '')
  if (!LOCAL_HOST_PATTERN.test(baseUrl)) {
    throw new Error(`BASE_URL must point at a loopback host, got: ${baseUrl}`)
  }
  return baseUrl
}

export function resolveTestType(env) {
  const testType = env.TEST_TYPE || 'average-load'
  if (!PROFILES[testType]) {
    throw new Error(
      `TEST_TYPE must be one of ${Object.keys(PROFILES).join(', ')}, got: ${testType}`,
    )
  }
  return testType
}

/** The `JOURNEYS=a,b` selection, every journey when unset. */
export function resolveJourneys(env) {
  const raw = (env.JOURNEYS || '').trim()
  if (raw === '') return Object.keys(JOURNEYS)

  const selected = raw
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean)
  const unknown = selected.filter((name) => !JOURNEYS[name])
  if (unknown.length > 0) {
    throw new Error(
      `unknown journey(s) ${unknown.join(', ')}; available: ${Object.keys(JOURNEYS).join(', ')}`,
    )
  }
  return selected
}

/** A positive integer from `env[name]`, `fallback` when unset. */
export function resolvePositiveInteger(env, name, fallback) {
  const raw = env[name]
  const value = raw === undefined || raw === '' ? fallback : Number(raw)
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${name} must be a positive integer, got: ${raw}`)
  }
  return value
}

/** The journeys that pick from the seeded users. */
const READ_JOURNEYS = ['get-user', 'get-users-by-ids']

/**
 * The seeded ids, checked up front: a read journey with none to pick from would request
 * `/users/undefined` on every iteration and fail as if the service had regressed.
 */
export function resolveUserIds(journeys, userIds) {
  const ids = Array.isArray(userIds) ? userIds.filter((id) => typeof id === 'string') : []
  if (ids.length === 0 && journeys.some((journey) => READ_JOURNEYS.includes(journey))) {
    throw new Error(
      'no seeded users to read: USER_IDS_FILE is unset or empty. Run through the runner: node --run perf:k6',
    )
  }
  return ids
}

/** VUs and hold duration for the run: the profile's, unless VUS or DURATION override them. */
export function resolveLoad(env, testType) {
  const profile = PROFILES[testType]
  const vus = resolvePositiveInteger(env, 'VUS', profile.vus)
  return { vus, duration: env.DURATION || profile.duration }
}

/**
 * A smoke run is one iteration running every selected journey once, in order. Every other
 * profile gives each journey its own ramping scenario, so each has its own row and threshold
 * and a profile can be cut to one route with `span_name`.
 *
 * The scenarios run at the same time against one service and one database: `load.vus` is
 * per journey, the total is that times the number of journeys, and each journey's latencies
 * include the contention from the others. Select one journey with `JOURNEYS=` to measure it
 * alone.
 */
export function buildScenarios(testType, journeys, load) {
  if (testType === 'smoke') {
    return {
      smoke: { executor: 'shared-iterations', vus: 1, iterations: 1, exec: 'allJourneys' },
    }
  }

  return Object.fromEntries(
    journeys.map((journey) => [
      journey.replaceAll('-', '_'),
      {
        executor: 'ramping-vus',
        exec: JOURNEYS[journey],
        startVUs: 0,
        stages: [
          { duration: RAMP_DURATION, target: load.vus },
          { duration: load.duration, target: load.vus },
          { duration: RAMP_DURATION, target: 0 },
        ],
        gracefulRampDown: '5s',
      },
    ]),
  )
}

/**
 * Failure rate and checks everywhere; latency budgets only under load, because the single
 * requests of a smoke run include every cold cache and connection and say nothing about p95.
 *
 * A smoke run still declares a per-journey duration threshold, one that always passes,
 * because k6 only computes a tagged sub-metric that some threshold names, and the report's
 * per-journey table is built from those sub-metrics.
 */
export function buildThresholds(testType, journeys) {
  const thresholds = { checks: ['rate>0.99'] }
  for (const journey of journeys) {
    thresholds[`http_req_failed{journey:${journey}}`] = ['rate<0.01']
    thresholds[`http_req_duration{journey:${journey}}`] =
      testType === 'smoke' ? ['max>=0'] : [`p(95)<${P95_BUDGETS_MS[journey]}`]
  }
  return thresholds
}
