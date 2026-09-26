/**
 * Input parsing for [`runPerfStack.ts`](runPerfStack.ts), separate from it so it can be
 * tested without starting a stack: importing the runner runs it.
 */
import { parseRunnerArgs, type RunnerArgs, retargetPorts } from '@lokalise/load-testing-utils'

const COMMANDS = ['run', 'up', 'k6', 'down'] as const

const FLAGS = {
  keep: false,
  profiling: false,
  docker: true,
  migrate: true,
  probe: true,
  service: true,
  purgeProfiles: false,
}

export type Options = RunnerArgs<(typeof COMMANDS)[number], keyof typeof FLAGS>

export const HELP = `
Usage: node perf/runPerfStack.ts <up|run|k6|down> [flags] [-- k6 args]

  --keep             leave the stack up afterwards, for a second run against warm caches
  --profiling        start Pyroscope and profile the service during the run
  --no-docker        leave the containers alone, up and down
  --no-migrate       skip the migrations, for a database that has them
  --no-probe         do not start the database probe; the run cannot then report what it cost
  --no-service       do not start the service; the run uses whatever answers on the service port
  --purge-profiles   with 'down', delete the Pyroscope volume too
  --k6=local|docker  force one k6 instead of picking whichever is available;
                     docker also makes the stack listen on 0.0.0.0, not loopback
  --help             this

Anything else is handed to 'k6 run', e.g. -e JOURNEYS=get-user -e VUS=20.
`

export const parseOptions = (argv: string[]): Options =>
  parseRunnerArgs(argv, { commands: COMMANDS, flags: FLAGS, help: HELP })

/**
 * Each port perf.env names, and the `PERF_*` variable that moves it. The same variables move
 * the containers (docker-compose.perf.yml), so the service has to follow them or it keeps
 * dialling the default.
 */
export const PORT_VARIABLES: Record<string, string> = {
  '3100': 'PERF_SERVICE_PORT',
  '5452': 'PERF_POSTGRES_PORT',
  '6380': 'PERF_REDIS_PORT',
  '5673': 'PERF_RABBITMQ_PORT',
  '4568': 'PERF_FAUXQS_PORT',
  '4041': 'PERF_PYROSCOPE_PORT',
}

/** perf.env's values with every overridden port swapped in. */
export function retargetPerfEnv(
  values: Record<string, string>,
  env: NodeJS.ProcessEnv,
): Record<string, string> {
  return retargetPorts(values, PORT_VARIABLES, env)
}
