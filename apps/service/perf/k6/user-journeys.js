/**
 * k6 load test for the service's user API, against the local stack in perf/.
 *
 *   node --run perf:run                                # average-load
 *   node --run perf:run:smoke                          # one pass of each journey
 *   node --run perf:run -- -e JOURNEYS=get-user
 *   node --run perf:k6 -- -e VUS=10 -e DURATION=120s
 *
 * The runner passes BASE_URL, AUTH_TOKEN and USER_IDS_FILE. The script refuses to start
 * against anything but a loopback host.
 *
 * The read journeys draw from a pool of users the runner creates through the API before k6
 * starts and deletes after it ends (`SEED_USERS=`), outside the window the resource report
 * measures. USER_IDS_FILE names the JSON list of their ids, relative to this script.
 */
import { check, fail, sleep } from 'k6'
import http from 'k6/http'
import {
  buildScenarios,
  buildThresholds,
  JOURNEYS,
  P95_BUDGETS_MS,
  resolveBaseUrl,
  resolveJourneys,
  resolveLoad,
  resolvePositiveInteger,
  resolveTestType,
  resolveUserIds,
} from './lib/config.js'
import { markdownReport } from './lib/report.js'

const BASE_URL = resolveBaseUrl(__ENV)
const TEST_TYPE = resolveTestType(__ENV)
const SELECTED_JOURNEYS = resolveJourneys(__ENV)
const LOAD = resolveLoad(__ENV, TEST_TYPE)
const BATCH_SIZE = resolvePositiveInteger(__ENV, 'BATCH_SIZE', 10)
// `open` only works in the init context, so the ids are read here rather than in `setup()`.
const USER_IDS = resolveUserIds(
  SELECTED_JOURNEYS,
  __ENV.USER_IDS_FILE ? JSON.parse(open(__ENV.USER_IDS_FILE)) : undefined,
)
const THINK_TIME_S = Number(__ENV.THINK_TIME || 0.1)
const AUTH_TOKEN = __ENV.AUTH_TOKEN

export const options = {
  scenarios: buildScenarios(TEST_TYPE, SELECTED_JOURNEYS, LOAD),
  thresholds: buildThresholds(TEST_TYPE, SELECTED_JOURNEYS),
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)', 'count'],
}

const headers = (extra = {}) => ({
  authorization: `Bearer ${AUTH_TOKEN}`,
  ...extra,
})

// Only on requests that carry a body: Fastify answers 400 to a JSON content type with an
// empty body, which is what a DELETE with this header would send.
const JSON_BODY = { 'content-type': 'application/json' }

// The audience the api-visibility plugin grants internal routes and fields to. In a deployed
// environment the gateway stamps it; here k6 plays the gateway, as it does for the JWT.
const INTERNAL_AUDIENCE = { ...JSON_BODY, 'x-api-audience': 'internal' }

const params = (journey, name, extraHeaders) => ({
  headers: headers(extraHeaders),
  tags: { journey, name },
})

const pick = (items) => items[Math.floor(Math.random() * items.length)]

// Per VU, so it only disambiguates within one; the timestamp and the random part do the rest.
let seq = 0

function newUserBody(prefix) {
  seq += 1
  const unique = `${prefix}-${Date.now()}-${seq}-${Math.floor(Math.random() * 1e9)}`
  return JSON.stringify({
    name: `Perf ${unique}`,
    email: `${unique}@perf.example.com`,
    age: 30,
    internalNote: 'created by the k6 load test',
  })
}

export function setup() {
  if (!AUTH_TOKEN) {
    fail('AUTH_TOKEN is not set. Run through the runner: node --run perf:k6')
  }
  return { userIds: USER_IDS }
}

export function getUserJourney(data) {
  const res = http.get(
    `${BASE_URL}/users/${pick(data.userIds)}`,
    params('get-user', 'GET /users/:userId'),
  )
  check(res, { 'get user: 200': (r) => r.status === 200 })
  sleep(THINK_TIME_S)
}

export function getUsersByIdsJourney(data) {
  const userIds = Array.from({ length: BATCH_SIZE }, () => pick(data.userIds))
  const res = http.post(
    `${BASE_URL}/internal/users/get-by-ids`,
    JSON.stringify({ userIds }),
    params('get-users-by-ids', 'POST /internal/users/get-by-ids', INTERNAL_AUDIENCE),
  )
  check(res, {
    'get users by ids: 200': (r) => r.status === 200,
    'get users by ids: returns users': (r) => r.status === 200 && r.json('data').length > 0,
  })
  sleep(THINK_TIME_S)
}

/** The write path: create, read back, update, delete. */
export function userLifecycleJourney() {
  const journey = 'user-lifecycle'
  const created = http.post(
    `${BASE_URL}/users`,
    newUserBody('life'),
    params(journey, 'POST /users', JSON_BODY),
  )
  if (!check(created, { 'create user: 201': (r) => r.status === 201 })) {
    sleep(THINK_TIME_S)
    return
  }
  const userId = created.json('data.id')

  const read = http.get(`${BASE_URL}/users/${userId}`, params(journey, 'GET /users/:userId'))
  check(read, { 'read created user: 200': (r) => r.status === 200 })

  const updated = http.patch(
    `${BASE_URL}/users/${userId}`,
    JSON.stringify({ name: `Renamed ${userId}` }),
    params(journey, 'PATCH /users/:userId', JSON_BODY),
  )
  check(updated, { 'update user: 204': (r) => r.status === 204 })

  const deleted = http.del(
    `${BASE_URL}/users/${userId}`,
    null,
    params(journey, 'DELETE /users/:userId'),
  )
  check(deleted, { 'delete user: 204': (r) => r.status === 204 })
  sleep(THINK_TIME_S)
}

/** One pass of every selected journey, which is what a smoke run executes. */
export function allJourneys(data) {
  const journeys = { getUserJourney, getUsersByIdsJourney, userLifecycleJourney }
  for (const journey of SELECTED_JOURNEYS) {
    journeys[JOURNEYS[journey]](data)
  }
}

export function handleSummary(data) {
  const report = markdownReport(data, {
    baseUrl: BASE_URL,
    testType: TEST_TYPE,
    load: LOAD,
    journeys: SELECTED_JOURNEYS,
    budgets: P95_BUDGETS_MS,
  })
  return {
    stdout: report,
    'k6-report.md': report,
    // Read by the runner for CPU per request and share of a core.
    'k6-summary.json': JSON.stringify(data, null, 2),
  }
}
