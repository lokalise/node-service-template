/**
 * Brings the local load-test stack up, runs k6 against it, and takes it down again.
 *
 *   node --run perf:run            # up, average-load, down
 *   node --run perf:run:smoke      # up, one pass per journey, down
 *   node --run perf:up             # up, then wait; Ctrl+C tears it down
 *   node --run perf:k6             # against a stack that is already up
 *   node --run perf:down           # stop what a --keep run left behind
 *   node --run perf:analyze        # read the last profile, starting Pyroscope if needed
 *
 * What it does, in order: starts the containers, builds the API contracts, migrates the
 * database, starts the database probe and the service, waits for every `/health`, seeds the
 * users the read journeys need, scrapes the resource counters, runs k6, scrapes them again,
 * deletes the seeded users, appends what the run cost to the report, and stops everything.
 *
 * Output from every spawned process is prefixed per service in the terminal and kept in
 * `perf/.logs/<service>.log`, which is where a 5xx explains itself: k6 reports that a
 * request failed, never why.
 *
 * Arguments the runner does not recognise are passed through to `k6 run`, so
 * `node --run perf:run -- -e JOURNEYS=get-user` works.
 *
 * The lifecycle is here; the process, container, k6 and report plumbing comes from
 * `@lokalise/load-testing-utils`.
 */
import { chmodSync, existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import {
  appendReportSection,
  bindAddressEnv,
  type ComposeProject,
  composeArgs,
  composeDown,
  composeUp,
  formatResourcesSection,
  k6TargetHost,
  measureResources,
  ProcessSupervisor,
  type RecordedProcess,
  type ResolvedK6Mode,
  readEnvFile,
  readRunTotalsFile,
  refuseIfPortTaken,
  refuseProfilingOnWindows,
  resolveK6Mode,
  runK6,
  scrapeMetrics,
  scrapeResources,
  waitForHealth,
} from '@lokalise/load-testing-utils'
import { consoleError, consoleLog } from '../scripts/utils/loggingUtils.ts'
import { ensureKeyPair, type PerfKeyPair, readKeyPair, signToken } from './auth.ts'
import {
  HELP,
  type Options,
  parseOptions,
  resolveSeedUsers,
  retargetPerfEnv,
} from './runnerOptions.ts'
import { deleteUsers, seedUsers } from './seed.ts'

const HERE = dirname(fileURLToPath(import.meta.url))
const SERVICE_DIR = resolve(HERE, '..')
const LOG_DIR = join(HERE, '.logs')
const KEYS_FILE = join(HERE, '.auth', 'keys.json')
const ENV_FILE = join(HERE, 'perf.env')
const COMPOSE: ComposeProject = {
  file: join(HERE, 'docker-compose.perf.yml'),
  project: 'node-service-template-perf',
  cwd: HERE,
}
const K6_DIR = join(HERE, 'k6')
const K6_SCRIPT = 'user-journeys.js'
const K6_REPORT = join(K6_DIR, 'k6-report.md')
const K6_SUMMARY = join(K6_DIR, 'k6-summary.json')
// Read by the k6 script's init code, relative to the script, which works inside the container too.
const K6_SEED_FILE = 'seed-users.json'

const PORTS = {
  service: Number(process.env.PERF_SERVICE_PORT ?? '3100'),
  // Fixed: metricsPlugin from @lokalise/fastify-extras always listens on 9080.
  metrics: 9080,
  probe: Number(process.env.PERF_PROBE_PORT ?? '3323'),
  pyroscope: Number(process.env.PERF_PYROSCOPE_PORT ?? '4041'),
}

// Only the service: k6 never calls the probe, which serves every statement's SQL text and
// therefore stays on loopback even when a containerised k6 needs the service on 0.0.0.0.
const BIND_ADDRESS_VARIABLES = ['APP_BIND_ADDRESS']

/**
 * The only perf.env values a shell export may override. Everything else, the DSNs above all,
 * comes from the file, so a `DATABASE_URL` exported for the dev loop cannot point the
 * migrations and the load test's writes at another database. Ports move with `PERF_*_PORT`.
 */
const SHELL_OVERRIDABLE = ['LOG_LEVEL']

// Detachable, so a `--keep` run can return to the shell with the stack still up.
const supervisor = new ProcessSupervisor({ logDir: LOG_DIR, detachable: true })

/**
 * The perf configuration, as environment variables for a spawned process.
 *
 * Passed rather than left to `--env-file`, because `drizzle-kit` builds its config by calling
 * the service's own `getConfig()`, which reads `process.env` and throws on a variable nothing
 * set. One mechanism for every child is also one fewer thing to get wrong.
 *
 * The spawned process gets these merged over this one's environment, so the file wins over
 * the shell except for {@link SHELL_OVERRIDABLE}.
 */
function perfEnv(overrides: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  const fromFile = retargetPerfEnv(readEnvFile(ENV_FILE), process.env)
  const fromShell = Object.fromEntries(
    SHELL_OVERRIDABLE.filter((key) => process.env[key] !== undefined).map((key) => [
      key,
      process.env[key],
    ]),
  )
  return { ...fromFile, ...fromShell, ...overrides }
}

/** The bind address for the k6 mode, whatever the shell exports: perf.env wins there too. */
const serviceBindEnv = (k6Mode: ResolvedK6Mode) =>
  bindAddressEnv(k6Mode, BIND_ADDRESS_VARIABLES, {})

/** The service imports the contracts package from its dist, which git ignores. */
function buildContracts(): void {
  supervisor.run('contracts', 'pnpm', ['run', 'build:contracts'], { cwd: SERVICE_DIR })
}

function migrate(keys: PerfKeyPair): void {
  supervisor.run(
    'migrate',
    'pnpm',
    ['exec', 'drizzle-kit', 'migrate', '--config=./src/db/drizzle.config.ts'],
    { cwd: SERVICE_DIR, env: perfEnv({ JWT_PUBLIC_KEY: keys.publicKey }) },
  )
}

function startProbe(): void {
  supervisor.start('probe', 'node', ['probe/server.ts'], {
    cwd: HERE,
    env: perfEnv({
      PERF_PROBE_BIND_ADDRESS: '127.0.0.1',
      PERF_PROBE_PORT: String(PORTS.probe),
    }),
  })
}

function startService(options: Options, k6Mode: ResolvedK6Mode, keys: PerfKeyPair): void {
  // The service starts its own profiler from `PYROSCOPE_ENABLED`, so this flag only has to
  // set the variable. perf.env already points `PYROSCOPE_SERVER_ADDRESS` at the container.
  supervisor.start('service', 'node', ['src/server.ts'], {
    cwd: SERVICE_DIR,
    env: perfEnv({
      ...serviceBindEnv(k6Mode),
      JWT_PUBLIC_KEY: keys.publicKey,
      ...(options.flags.profiling ? { PYROSCOPE_ENABLED: 'true' } : {}),
    }),
  })
}

/**
 * Before anything starts, and outside the bring-up that tears down on failure: the port is
 * usually taken by a `--keep` stack, and a refusal must not take that stack down with it.
 */
async function refuseTakenPorts(options: Options): Promise<void> {
  const ours = [
    ['probe', PORTS.probe, options.flags.probe],
    ['service', PORTS.service, options.flags.service],
  ] as const
  for (const [name, port, starting] of ours) {
    if (starting) {
      await refuseIfPortTaken(name, port, { hint: `run with --no-${name} to measure it instead` })
    }
  }
  if (options.flags.service) {
    await refuseIfPortTaken('service metrics', PORTS.metrics, {
      hint: 'another service with METRICS_ENABLED=true holds it; stop it or pass --no-service',
    })
  }
}

type StackRecord = { profiling?: boolean; k6Mode?: ResolvedK6Mode }

/** The record of a stack whose processes are still running, not of one that crashed. */
const keptStackRecord = (): StackRecord | undefined =>
  supervisor.recordedProcesses().length > 0
    ? (supervisor.readState() as StackRecord | undefined)
    : undefined

/**
 * A containerised k6 cannot reach a service a local-k6 stack bound to loopback. Checked
 * against what the stack recorded, so the error names the cause rather than k6 timing out.
 */
function refuseUnreachableStack(k6Mode: ResolvedK6Mode, stack: StackRecord | undefined): void {
  if (k6Mode === 'docker' && stack?.k6Mode === 'local') {
    throw new Error(
      'the stack was brought up for a local k6 and the service listens on 127.0.0.1, which a ' +
        'k6 container cannot reach. Run with --k6=local, or bring the stack up again with --k6=docker',
    )
  }
}

async function bringUp(
  options: Options,
  k6Mode: ResolvedK6Mode,
  keptStack: StackRecord | undefined,
): Promise<void> {
  const keys = ensureKeyPair(KEYS_FILE)
  if (options.flags.docker) {
    composeUp(supervisor, COMPOSE, { profiles: options.flags.profiling ? ['profiling'] : [] })
  }
  buildContracts()
  if (options.flags.migrate) migrate(keys)

  const hint = `see ${LOG_DIR}`
  if (options.flags.probe) {
    startProbe()
    await waitForHealth('probe', `http://localhost:${PORTS.probe}/health`, {
      timeoutMs: 60_000,
      hint,
    })
  }
  if (options.flags.service) {
    startService(options, k6Mode, keys)
    await waitForHealth('service', `http://localhost:${PORTS.service}/health`, { hint })
  }

  if (k6Mode === 'docker' && options.flags.service) {
    consoleLog(
      `[runner] k6 runs in Docker, so the service listens on 0.0.0.0:${PORTS.service} and is reachable from your network until the stack goes down`,
    )
  }

  // A run against a kept stack must not overwrite its record: that record is what lets
  // `perf:down` find the kept service and probe.
  if (!keptStack) {
    supervisor.writeState({ profiling: options.flags.profiling, k6Mode } satisfies StackRecord)
  }
  printSummary(options)
}

function printSummary(options: Options): void {
  const lines = [
    '',
    `  service          http://localhost:${PORTS.service}`,
    `  metrics          http://localhost:${PORTS.metrics}/metrics`,
    `  database probe   http://localhost:${PORTS.probe}/db-stats?top=10`,
    ...(options.flags.profiling ? [`  pyroscope        http://localhost:${PORTS.pyroscope}`] : []),
    `  logs             ${LOG_DIR}`,
    '',
  ]
  consoleLog(lines.join('\n'))
}

const isAlive = (pid: number): boolean => {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

/**
 * `stopAll` only signals. The service still has to flush its last profile window to
 * Pyroscope on the way out, so the containers wait for it rather than going down underneath.
 */
async function waitForExit(processes: RecordedProcess[], timeoutMs = 20_000): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (processes.some(({ pid }) => isAlive(pid)) && Date.now() < deadline) {
    await sleep(100)
  }
}

/**
 * Stops `processes`, by default everything this run started, and the containers. Always
 * with the profile: a `down` without it leaves a profiled run's Pyroscope container running,
 * and the network it holds with it.
 *
 * A run against a kept stack stops only what it started itself: the containers and the
 * record belong to the kept stack, which `perf:down` takes down.
 */
async function tearDown(
  options: Options,
  processes = supervisor.runningProcesses(),
  { keptStack = false } = {},
): Promise<void> {
  supervisor.stopAll(processes)
  await waitForExit(processes)
  if (keptStack) return
  if (options.flags.docker) {
    composeDown(supervisor, COMPOSE, {
      profiles: ['profiling'],
      removeVolumes: options.flags.purgeProfiles,
    })
  }
  supervisor.clearState()
}

/**
 * A k6 that fails before its summary would otherwise leave the previous run's files behind,
 * and the resources section would be appended to the previous run's report, so both go
 * before every run.
 *
 * The `grafana/k6` image runs as an unprivileged user of its own, which on a Linux host
 * cannot create files in a directory the host user owns. For a containerised k6 both output
 * files are therefore created empty and world-writable up front: k6 then only has to
 * truncate them, which the file's own mode allows.
 */
function prepareK6Output(k6Mode: ResolvedK6Mode): void {
  for (const file of [K6_REPORT, K6_SUMMARY]) rmSync(file, { force: true })
  if (k6Mode !== 'docker') return
  for (const file of [K6_REPORT, K6_SUMMARY]) {
    writeFileSync(file, '')
    chmodSync(file, 0o666)
  }
}

const k6WroteReport = (): boolean =>
  existsSync(K6_REPORT) && readFileSync(K6_REPORT, 'utf8').trim() !== ''

/**
 * Seeds the users, runs k6 between two resource scrapes, deletes the users again, and
 * appends what the run cost to the report. The seeding and the cleanup stay outside the
 * scrapes, so the report covers the journeys alone.
 */
async function runK6WithReport(options: Options, k6Mode: ResolvedK6Mode): Promise<number> {
  const host = k6TargetHost(k6Mode)
  const serviceUrl = `http://localhost:${PORTS.service}`
  const metricsUrl = `http://localhost:${PORTS.metrics}/metrics`
  const token = signToken(readKeyPair(KEYS_FILE))
  const seedFile = join(K6_DIR, K6_SEED_FILE)
  prepareK6Output(k6Mode)

  const userIds = await seedUsers(serviceUrl, token, resolveSeedUsers(options.passthrough))
  writeFileSync(seedFile, JSON.stringify(userIds))
  let measured: Awaited<ReturnType<typeof measureK6>>
  try {
    measured = await measureK6(options, k6Mode, { host, metricsUrl, token })
  } finally {
    rmSync(seedFile, { force: true })
    const failed = await deleteUsers(serviceUrl, token, userIds)
    if (failed > 0) consoleError(`[runner] ${failed} seeded user(s) could not be deleted`)
  }
  const { result: exitCode, delta } = measured

  const section = formatResourcesSection(delta, readRunTotalsFile(K6_SUMMARY))
  const wroteReport = k6WroteReport()
  appendReportSection(K6_REPORT, section)
  consoleLog(`\n${section}`)
  consoleLog(
    wroteReport
      ? `[runner] report: ${K6_REPORT}`
      : `[runner] k6 wrote no report (it failed before its summary); ${K6_REPORT} has the resources only`,
  )
  return exitCode
}

function measureK6(
  options: Options,
  k6Mode: ResolvedK6Mode,
  { host, metricsUrl, token }: { host: string; metricsUrl: string; token: string },
) {
  return measureResources(
    () =>
      scrapeResources({
        metricsUrl,
        probeUrl: `http://localhost:${PORTS.probe}/db-stats?statements=all`,
      }),
    () =>
      runK6(supervisor, {
        mode: k6Mode,
        cwd: K6_DIR,
        script: K6_SCRIPT,
        args: options.passthrough,
        env: {
          BASE_URL: `http://${host}:${PORTS.service}`,
          AUTH_TOKEN: token,
          USER_IDS_FILE: K6_SEED_FILE,
        },
        docker: { hostDir: HERE },
      }),
    { sampleMetrics: () => scrapeMetrics(metricsUrl) },
  )
}

/**
 * Reads a profile with `pyroscope-analyze`, first starting the Pyroscope container if a
 * profiled run without `--keep` took it down: the profiles outlive it on a named volume.
 * The container is left running for a second query; `perf:down` removes it.
 */
async function analyze(options: Options): Promise<number> {
  const url = `http://localhost:${PORTS.pyroscope}`
  supervisor.run(
    'pyroscope',
    'docker',
    composeArgs(COMPOSE, ['profiling'], 'up', '-d', 'pyroscope'),
    {
      cwd: COMPOSE.cwd,
    },
  )
  // /ready turns 200 about a minute after a cold start.
  await waitForHealth('pyroscope', `${url}/ready`, { timeoutMs: 120_000 })
  return supervisor.runToExit(
    'pnpm',
    [
      'exec',
      'pyroscope-analyze',
      '--service',
      'node-service-template',
      '--url',
      url,
      ...options.passthrough,
    ],
    { cwd: SERVICE_DIR },
  )
}

async function main(): Promise<void> {
  // After `analyze`, `--help` is pyroscope-analyze's.
  if (process.argv[2] !== 'analyze' && process.argv.includes('--help')) {
    consoleLog(HELP)
    return
  }
  const options = parseOptions(process.argv.slice(2))

  if (options.command === 'down') {
    await tearDown(options, supervisor.recordedProcesses())
    return
  }

  if (options.command === 'analyze') {
    process.exitCode = await analyze(options)
    return
  }

  if (options.command === 'k6') {
    await runK6Command(options)
    return
  }

  await runStack(options)
}

/** `k6`: a run against a stack that is already up, which it neither starts nor stops. */
async function runK6Command(options: Options): Promise<void> {
  const k6Mode = resolveK6Mode(options.k6Mode)
  try {
    refuseUnreachableStack(k6Mode, keptStackRecord())
    process.exitCode = await runK6WithReport(options, k6Mode)
  } catch (error) {
    consoleError(`[runner] ${String(error)}`)
    process.exitCode = 1
  }
}

/** `run` and `up`. */
async function runStack(options: Options): Promise<void> {
  const k6Mode = resolveK6Mode(options.k6Mode)
  // A `--keep` stack still running: this run joins it rather than owning the stack.
  const keptStack = keptStackRecord()

  try {
    resolveSeedUsers(options.passthrough)
    refuseUnreachableStack(k6Mode, keptStack)
    // @pyroscope/nodejs cannot start on Windows: refuse rather than hand back an empty profile.
    if (options.flags.profiling && options.flags.service) {
      refuseProfilingOnWindows('service', { hint: 'pass --no-service' })
    }
    await refuseTakenPorts(options)
  } catch (error) {
    consoleError(`[runner] ${String(error)}`)
    process.exitCode = 1
    return
  }

  const ownTearDown = () => tearDown(options, undefined, { keptStack: keptStack !== undefined })

  let interrupted = false
  const onSignal = () => {
    if (interrupted) return
    interrupted = true
    void ownTearDown().finally(() => process.exit(130))
  }
  for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, onSignal)

  try {
    await bringUp(options, k6Mode, keptStack)
  } catch (error) {
    consoleError(`[runner] bring-up failed: ${String(error)}`)
    await ownTearDown()
    process.exitCode = 1
    return
  }

  if (options.command === 'up') {
    consoleLog('[runner] stack is up. Ctrl+C to tear it down.')
    // Nothing to await: the spawned children and their log relay hold the event loop open.
    return
  }

  try {
    process.exitCode = await runK6WithReport(options, k6Mode)
  } catch (error) {
    // On Windows the started processes are detached and outlive this one.
    await ownTearDown()
    throw error
  }

  if (options.flags.keep) {
    consoleLog('[runner] --keep: leaving the stack up. `node --run perf:down` when finished.')
    supervisor.detach()
    return
  }
  await ownTearDown()
  if (options.flags.profiling) {
    consoleLog(
      '[runner] the profiles are kept on a volume: `node --run perf:analyze` restarts Pyroscope to read them',
    )
  }
}

await main()
