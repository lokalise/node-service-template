/**
 * Brings the local load-test stack up, runs k6 against it, and takes it down again.
 *
 *   node --run perf:run            # up, average-load, down
 *   node --run perf:run:smoke      # up, one pass per journey, down
 *   node --run perf:up             # up, then wait; Ctrl+C tears it down
 *   node --run perf:k6             # against a stack that is already up
 *   node --run perf:down           # stop what a --keep run left behind
 *
 * What it does, in order: starts the containers, builds the API contracts, migrates the
 * database, starts the database probe and the service, waits for every `/health`, scrapes
 * the resource counters, runs k6, scrapes them again, appends what the run cost to the
 * report, and stops everything.
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
import { chmodSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  appendReportSection,
  bindAddressEnv,
  type ComposeProject,
  composeDown,
  composeUp,
  formatResourcesSection,
  k6TargetHost,
  measureResources,
  omitExported,
  ProcessSupervisor,
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
import { ensureKeyPair, type PerfKeyPair, readKeyPair, signToken } from './auth.ts'
import { HELP, type Options, parseOptions, retargetPerfEnv } from './runnerOptions.ts'

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

const PORTS = {
  service: Number(process.env.PERF_SERVICE_PORT ?? '3100'),
  // Fixed: metricsPlugin from @lokalise/fastify-extras always listens on 9080.
  metrics: 9080,
  probe: Number(process.env.PERF_PROBE_PORT ?? '3323'),
  pyroscope: Number(process.env.PERF_PYROSCOPE_PORT ?? '4041'),
}

const BIND_ADDRESS_VARIABLES = ['APP_BIND_ADDRESS', 'PERF_PROBE_BIND_ADDRESS']

// Detachable, so a `--keep` run can return to the shell with the stack still up.
const supervisor = new ProcessSupervisor({ logDir: LOG_DIR, detachable: true })

/**
 * The perf configuration, as environment variables for a spawned process.
 *
 * Passed rather than left to `--env-file`, because `drizzle-kit` builds its config by calling
 * the service's own `getConfig()`, which reads `process.env` and throws on a variable nothing
 * set. One mechanism for every child is also one fewer thing to get wrong.
 *
 * A variable already exported in the shell is left alone, which is what `node --env-file`
 * does: overriding a port or a DSN from the shell has to keep working.
 */
function perfEnv(overrides: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  const fromFile = omitExported(retargetPerfEnv(readEnvFile(ENV_FILE), process.env))
  return { ...fromFile, ...overrides }
}

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

function startProbe(k6Mode: ResolvedK6Mode): void {
  supervisor.start('probe', 'node', ['probe/server.ts'], {
    cwd: HERE,
    env: perfEnv({
      ...bindAddressEnv(k6Mode, BIND_ADDRESS_VARIABLES),
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
      ...bindAddressEnv(k6Mode, BIND_ADDRESS_VARIABLES),
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

async function bringUp(options: Options, k6Mode: ResolvedK6Mode): Promise<void> {
  const keys = ensureKeyPair(KEYS_FILE)
  if (options.flags.docker) {
    composeUp(supervisor, COMPOSE, { profiles: options.flags.profiling ? ['profiling'] : [] })
  }
  buildContracts()
  if (options.flags.migrate) migrate(keys)

  const hint = `see ${LOG_DIR}`
  if (options.flags.probe) {
    startProbe(k6Mode)
    await waitForHealth('probe', `http://localhost:${PORTS.probe}/health`, {
      timeoutMs: 60_000,
      hint,
    })
  }
  if (options.flags.service) {
    startService(options, k6Mode, keys)
    await waitForHealth('service', `http://localhost:${PORTS.service}/health`, { hint })
  }

  supervisor.writeState({ profiling: options.flags.profiling })
  printSummary(options)
}

function printSummary(options: Options): void {
  console.log('')
  console.log('  service          http://localhost:%d', PORTS.service)
  console.log('  metrics          http://localhost:%d/metrics', PORTS.metrics)
  console.log('  database probe   http://localhost:%d/db-stats?top=10', PORTS.probe)
  if (options.flags.profiling) {
    console.log('  pyroscope        http://localhost:%d', PORTS.pyroscope)
  }
  console.log('  logs             %s', LOG_DIR)
  console.log('')
}

/**
 * Stops `processes`, by default everything this run started, and the containers. Always
 * with the profile: a `down` without it leaves a profiled run's Pyroscope container running,
 * and the network it holds with it.
 */
function tearDown(options: Options, processes = supervisor.runningProcesses()): void {
  supervisor.stopAll(processes)
  if (options.flags.docker) {
    composeDown(supervisor, COMPOSE, {
      profiles: ['profiling'],
      removeVolumes: options.flags.purgeProfiles,
    })
  }
  supervisor.clearState()
}

/**
 * A k6 that fails before its summary would otherwise leave the previous run's file behind,
 * so the summary goes before every run.
 *
 * The `grafana/k6` image runs as an unprivileged user of its own, which on a Linux host
 * cannot create files in a directory the host user owns. For a containerised k6 both output
 * files are therefore created empty and world-writable up front: k6 then only has to
 * truncate them, which the file's own mode allows.
 */
function prepareK6Output(k6Mode: ResolvedK6Mode): void {
  rmSync(K6_SUMMARY, { force: true })
  if (k6Mode !== 'docker') return
  for (const file of [K6_REPORT, K6_SUMMARY]) {
    writeFileSync(file, '')
    chmodSync(file, 0o666)
  }
}

/** Runs k6 between two resource scrapes and appends what the run cost to its report. */
async function runK6WithReport(options: Options, k6Mode: ResolvedK6Mode): Promise<number> {
  const host = k6TargetHost(k6Mode)
  const metricsUrl = `http://localhost:${PORTS.metrics}/metrics`
  const token = signToken(readKeyPair(KEYS_FILE))
  prepareK6Output(k6Mode)

  const { result: exitCode, delta } = await measureResources(
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
        },
        docker: { hostDir: HERE },
      }),
    { sampleMetrics: () => scrapeMetrics(metricsUrl) },
  )

  const section = formatResourcesSection(delta, readRunTotalsFile(K6_SUMMARY))
  appendReportSection(K6_REPORT, section)
  console.log(`\n${section}`)
  console.log(`[runner] report: ${K6_REPORT}`)
  return exitCode
}

async function main(): Promise<void> {
  if (process.argv.includes('--help')) {
    console.log(HELP)
    return
  }
  const options = parseOptions(process.argv.slice(2))

  if (options.command === 'down') {
    tearDown(options, supervisor.recordedProcesses())
    return
  }

  const k6Mode = resolveK6Mode(options.k6Mode)

  if (options.command === 'k6') {
    process.exitCode = await runK6WithReport(options, k6Mode)
    return
  }

  try {
    // @pyroscope/nodejs cannot start on Windows: refuse rather than hand back an empty profile.
    if (options.flags.profiling && options.flags.service) {
      refuseProfilingOnWindows('service', { hint: 'pass --no-service' })
    }
    await refuseTakenPorts(options)
  } catch (error) {
    console.error(`[runner] ${String(error)}`)
    process.exitCode = 1
    return
  }

  let interrupted = false
  const onSignal = () => {
    if (interrupted) return
    interrupted = true
    tearDown(options)
    process.exit(130)
  }
  for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, onSignal)

  try {
    await bringUp(options, k6Mode)
  } catch (error) {
    console.error(`[runner] bring-up failed: ${String(error)}`)
    tearDown(options)
    process.exitCode = 1
    return
  }

  if (options.command === 'up') {
    console.log('[runner] stack is up. Ctrl+C to tear it down.')
    // Nothing to await: the spawned children and their log relay hold the event loop open.
    return
  }

  try {
    process.exitCode = await runK6WithReport(options, k6Mode)
  } catch (error) {
    // On Windows the started processes are detached and outlive this one.
    tearDown(options)
    throw error
  }

  if (options.flags.keep) {
    console.log('[runner] --keep: leaving the stack up. `node --run perf:down` when finished.')
    supervisor.detach()
    return
  }
  tearDown(options)
}

await main()
