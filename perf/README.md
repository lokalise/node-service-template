# Local load testing and profiling

A load-test stack that runs entirely on your machine: the service as a host process, its
datastores and queues in containers, [k6](https://grafana.com/docs/k6/latest/) driving it, a
database probe that says what a run cost, and [Pyroscope](https://grafana.com/docs/pyroscope/latest/)
profiling it on request.

Nothing here touches a shared environment. The k6 script refuses to start against any host that
is not a loopback address.

- [Why](#why)
- [Quick start](#quick-start)
- [What it measures](#what-it-measures)
- [Running it](#running-it)
- [Profiling a run](#profiling-a-run)
- [What a run reports](#what-a-run-reports)
- [How a run is wired](#how-a-run-is-wired)
- [Ports](#ports)
- [Adapting it to your service](#adapting-it-to-your-service)
- [Troubleshooting](#troubleshooting)

## Why

A load test on its own answers "is it fast enough". It does not answer "why", and a number from a
shared environment moves with whatever else is running there. This stack trades realism for three
things a shared environment cannot give you cheaply:

- **Known data and a quiet machine**, so two runs are comparable.
- **What the database did.** A [probe](#the-database-probe) reports how many statements and rows a
  run cost. A write path that issues one statement per row passes every latency threshold on a
  laptop with an empty table; its statement count does not.
- **Where the process spent its time.** A [profile](#profiling-a-run) names the function, and every
  sample carries the route it was taken under, so a flame graph can be cut to one endpoint.

The plumbing (processes, containers, k6, the resource report, the probe) comes from
[`@lokalise/load-testing-utils`](https://www.npmjs.com/package/@lokalise/load-testing-utils) and the
profiler from [`@lokalise/pyroscope-profiling`](https://www.npmjs.com/package/@lokalise/pyroscope-profiling).
What lives here is only what is specific to this service: which containers, which migrations, which
journeys.

## Quick start

You need Docker and the workspace installed (`pnpm install`). [k6](https://grafana.com/docs/k6/latest/set-up/install-k6/)
is optional: without it the runner falls back to the `grafana/k6` image.

```shell
node --run perf:run:smoke                   # up, one pass per journey, down
node --run perf:run -- --profiling --keep   # up, average load (5 VUs/journey, 60s), profiled, left up
node --run perf:analyze                     # the profile of that run, as a table
node --run perf:down                        # stop what --keep left
```

A smoke run takes well under a minute once the images are pulled, and is the thing to run first:
it proves the stack comes up and every journey works before you spend a minute on load.

## What it measures

| Journey | `JOURNEYS=` | What it exercises | p95 budget |
|---|---|---|---|
| Get user | `get-user` | `GET /users/:userId` over a pool of seeded users. Mostly served from the in-memory `UserLoader` cache | 50 ms |
| Get users by ids | `get-users-by-ids` | `POST /internal/users/get-by-ids` with 10 random ids, as an internal caller | 75 ms |
| User lifecycle | `user-lifecycle` | The write path: `POST /users`, `GET` it back, `PATCH`, `DELETE` | 100 ms |

Budgets are per request, held only under load (a smoke run checks failures only, because single
requests include every cold cache and connection). They live in
[`k6/lib/config.js`](k6/lib/config.js) as `P95_BUDGETS_MS`.

Before the journeys start, `setup()` creates 100 users through the API (`SEED_USERS=`) for the read
journeys to draw from, and `teardown()` deletes them again. Those requests are tagged
`journey:setup` and count towards no journey's numbers.

## Running it

### One-shot runs

```shell
node --run perf:run:smoke                          # TEST_TYPE=smoke
node --run perf:run                                # TEST_TYPE=average-load
node --run perf:run -- -e TEST_TYPE=stress         # 20 VUs per journey, 3 minutes
node --run perf:run -- -e JOURNEYS=get-user,user-lifecycle
node --run perf:run -- -e VUS=10 -e DURATION=2m -e THINK_TIME=0
```

[`runPerfStack.ts`](runPerfStack.ts) starts the containers, builds the API contracts, runs the
migrations, starts the database probe and the service, waits for every `/health`, runs k6 between
two resource scrapes, appends what the run cost to the report, and stops everything again.

Anything the runner does not recognise goes to `k6 run`, so `-e NAME=value` reaches the script's
`__ENV`. The variables the script reads:

| Variable | Default | What it does |
|---|---|---|
| `TEST_TYPE` | `average-load` | `smoke` (one iteration of every journey), `average-load` (5 VUs, 60s hold), `stress` (20 VUs, 3m hold) |
| `JOURNEYS` | all | Comma-separated subset of the journeys above |
| `VUS` | per profile | VUs per journey. Each journey ramps to it over 10s, holds, and ramps down over 10s |
| `DURATION` | per profile | The hold between the two ramps |
| `THINK_TIME` | `0.1` | Seconds each VU sleeps between iterations. `0` for maximum pressure |
| `SEED_USERS` | `100` | Users `setup()` creates for the read journeys |
| `BATCH_SIZE` | `10` | Ids per `get-users-by-ids` request |

The runner's own flags, recognised wherever they appear (including after the `--` that `node --run`
needs before forwarded arguments):

| Flag | What it does |
|---|---|
| `--keep` | Leave the stack up afterwards, for more runs against warm caches |
| `--profiling` | Start Pyroscope and profile the service during the run |
| `--no-docker` | Leave the containers alone, up and down |
| `--no-migrate` | Skip the migrations |
| `--no-probe`, `--no-service` | Do not start that process; the run uses whatever answers on its port |
| `--purge-profiles` | With `down`, delete the Pyroscope volume too |
| `--k6=local`, `--k6=docker` | Force one k6 instead of picking whichever is available. With Docker k6 the service and the probe listen on `0.0.0.0` instead of loopback, so a stack brought up with `perf:up` needs `-- --k6=docker` before a `perf:k6:docker` against it |

### Holding the stack open

```shell
node --run perf:up                 # the same bring-up, then it waits; Ctrl+C tears it down
node --run perf:k6                 # in another terminal, as often as you like
node --run perf:k6 -- -e JOURNEYS=get-user -e VUS=20
```

That is the shape for iterating on the service or a budget: the stack is built once and a run costs
only the run. After changing service code, restart the stack (`Ctrl+C`, `perf:up`); the service is
not started in watch mode, because a restart mid-run would show up as a failed run.

`perf:up` and `perf:run` refuse to start when the service's, the probe's or the metrics port
already answers, because that failure is otherwise invisible: the new process would die on
`EADDRINUSE`, the health check would pass against whatever was there first, and the run would
measure a process from an earlier session. Usually it is a `--keep` stack: `node --run perf:down`.

### Logs

Output from each spawned process is prefixed per process in your terminal and kept in
`perf/.logs/<name>.log`. `perf/.logs/service.log` is where a 5xx explains itself: k6 reports that a
request failed, never why. The service runs with `LOG_LEVEL=warn`, so the log holds errors rather
than a line per request; override it from the shell (`LOG_LEVEL=info node --run perf:up`) when you
need more.

## Profiling a run

```shell
node --run perf:run -- --profiling --keep
node --run perf:analyze
```

`--profiling` adds a Pyroscope container and starts the service with `PYROSCOPE_ENABLED=true`. The
service starts its own profiler ([`src/serverInternal.ts`](../src/serverInternal.ts)), and
[`perf.env`](perf.env) already points it at the container and shortens the flush interval to 15
seconds, so a one-minute run produces several data points rather than one.

`perf:analyze` is `pyroscope-analyze --service node-service-template --url http://localhost:4041`,
and takes more options after `--`:

```shell
# Where the wall-clock time went over the last 15 minutes (the default range)
node --run perf:analyze

# CPU instead of wall time, from the same samples: wide in wall and narrow in CPU is waiting
# (a query, a downstream call), wide in both is the service burning CPU
node --run perf:analyze -- --type cpu

# One endpoint only. Every request's samples carry its route as `span_name`
node --run perf:analyze -- --type cpu --select 'span_name="POST /users"'

# Who called the frame the table named
node --run perf:analyze -- --type cpu --tree --min-share 2

# Heap retained, by call path
node --run perf:analyze -- --type heap
```

The profile of the average-load run of this template, for instance, shows RS256 verification of the
JWT (`verify`, `getKeyObjectSlots`) among the top CPU frames on every route: a real cost worth
knowing about before optimising anything behind it.

### Comparing two runs

Profiles live on a named volume that `down` spares, so the run before a change is still there to
read the run after it against:

```shell
node --run perf:run -- --profiling              # baseline
# ...change the code...
MARK=$(date +%s000)
node --run perf:run -- --profiling --keep       # the same run against the changed code
node --run perf:analyze -- --from "$MARK" --against-from now-1h --against-until "$MARK"
```

Rows are ordered by how far the two ranges moved apart, so the frame the change affected comes
first. Compare runs of the same shape (same `TEST_TYPE`, `VUS`, journeys), or the deltas measure the
difference between the runs rather than the change. `node --run perf:down -- --purge-profiles`
drops the stored profiles.

The UI is at <http://localhost:4041> while the stack is up, if you prefer a flame graph.

### Before reading numbers off a profiled run

- A fresh Pyroscope drops what it is sent for about its first minute. A smoke run is over before
  that; use the average-load run, or `perf:up -- --profiling` and wait a minute before `perf:k6`.
- Sampling costs a few percent of CPU, so latency percentiles from a profiled run are not
  comparable with an unprofiled baseline.
- A wall profile of async Node code does not roll up: a function that drove a whole request can
  show a near-zero cumulative share, so read self time first (the default table) and use `--tree`
  only once a frame is named.

See the [`@lokalise/pyroscope-profiling` README](https://github.com/lokalise/shared-ts-libs/tree/main/packages/app/pyroscope-profiling#readme)
for everything the profiler and `pyroscope-analyze` can do, including labelling background jobs
with `withJobLabels`.

### Profiling outside this stack

The profiler is part of the service, not of this stack. Any environment can turn it on:

```shell
PYROSCOPE_ENABLED=true PYROSCOPE_SERVER_ADDRESS=http://localhost:4040 node --run start:dev
```

See [the environment variables](../docs/environment-variables.md#vendors-pyroscope) for shipping
to a shared Pyroscope or Grafana Cloud Profiles.

## What a run reports

`k6/k6-report.md` and `k6/k6-summary.json`. The report has a row per journey (requests, failure
rate, median, p95, p99, max, budget, outcome) and a `Resources` section the runner appends from the
service's Prometheus endpoint and the database probe, scraped before and after the run:

- CPU seconds, CPU as a share of one core, and CPU milliseconds per request. A Node service on one
  event loop saturates near 100% of a core, and CPU per request is the figure that compares across
  runs with different load.
- Resident memory, heap and GC time.
- Event-loop lag, sampled every five seconds during the run.
- Postgres statements, rows returned and rows written, and the statements that cost the most
  database time during the run.

The statement counts are the half that is deterministic: they do not depend on how fast your
machine is, so a change that doubles them is visible on any laptop.

The k6 process exits non-zero when a threshold is crossed, and the runner passes that exit code on.

## How a run is wired

```text
k6 ──────────► service :3100  (host process, node src/server.ts)
                  │
                  ├──► postgres :5452   (pg_stat_statements)
                  ├──► redis :6380
                  ├──► rabbitmq :5673
                  ├──► fauxqs :4568     (SNS/SQS)
                  └──► pyroscope :4041  (with --profiling only)

runPerfStack ──► service :9080/metrics, probe :3323/db-stats
                 (at each end of a run: what the process and the database did)
```

Every file here:

| File | What it is |
|---|---|
| [`runPerfStack.ts`](runPerfStack.ts) | The runner: lifecycle, env, ports |
| [`runnerOptions.ts`](runnerOptions.ts) | Its flag parsing and port retargeting, split out so it is testable |
| [`auth.ts`](auth.ts) | The key pair and the JWT the run authenticates with |
| [`perf.env`](perf.env) | The service's configuration for a run |
| [`docker-compose.perf.yml`](docker-compose.perf.yml) | The containers |
| [`postgres-init.sh`](postgres-init.sh) | Creates `pg_stat_statements` |
| [`probe/server.ts`](probe/server.ts) | The database probe |
| [`k6/user-journeys.js`](k6/user-journeys.js) | The k6 script: setup, journeys, teardown, summary |
| [`k6/lib/config.js`](k6/lib/config.js) | Load profiles, journey selection, scenarios, thresholds, budgets |
| [`k6/lib/report.js`](k6/lib/report.js) | The markdown report |

### Configuration

[`perf.env`](perf.env) is the service's configuration for a run. The runner hands it to every
process it spawns rather than using `--env-file`, because `drizzle-kit` builds its config by calling
the service's `getConfig()`. A variable already exported in your shell wins over the file, as with
`node --env-file`. Your own `.env` is never read.

### Authentication

Every route but the health checks needs a JWT the service verifies against `JWT_PUBLIC_KEY`. On the
first bring-up the runner generates an RSA key pair into `perf/.auth/keys.json` (gitignored), starts
the service with the public half, and signs a token for k6 with the private half on every run.
`perf:k6` against a running stack reads the same pair, so it never invents a key the service does
not know.

The internal route additionally needs `x-api-audience: internal`, which in a deployed environment
the gateway stamps. Here k6 plays the gateway and sends it.

### The database probe

[`probe/server.ts`](probe/server.ts) answers one question over HTTP: what has the database done.
`GET /db-stats` returns counters, `?top=N` the statements that cost the most database time since
the container started, and `?statements=all` every statement, which is what the runner diffs across
a run. A route rather than a connection, because k6 has no database client without a custom binary.

Exact statement counts need `pg_stat_statements`, which the compose file preloads and
[`postgres-init.sh`](postgres-init.sh) creates. Postgres runs on tmpfs with `fsync` off: the data is
recreated on every run, so durability buys nothing and costs latency in exactly the writes a journey
is timing.

## Ports

Every one is off the default, so the stack runs next to the root `docker-compose.yml` and
`pnpm test` without evicting either, and every one but the metrics port is overridable. The variable
moves the container or the process, and the runner rewrites the matching address in `perf.env`.

| What | Port | Variable |
|---|---|---|
| The service | 3100 | `PERF_SERVICE_PORT` |
| The service's metrics | 9080 | none: fixed in `metricsPlugin` |
| Database probe | 3323 | `PERF_PROBE_PORT` |
| Postgres | 5452 | `PERF_POSTGRES_PORT` |
| Redis | 6380 | `PERF_REDIS_PORT` |
| RabbitMQ | 5673 | `PERF_RABBITMQ_PORT` |
| fauxqs | 4568 | `PERF_FAUXQS_PORT` |
| Pyroscope | 4041 | `PERF_PYROSCOPE_PORT` |

The metrics port is shared by every service built from this template with `METRICS_ENABLED=true`,
so only one of them can be under load at a time. `PERF_*_IMAGE` substitutes a different image for
any container.

## Adapting it to your service

When you build a service from this template, the parts to change are:

- **Journeys.** Add an exported function per journey to [`k6/user-journeys.js`](k6/user-journeys.js),
  register it in `JOURNEYS` and give it a budget in `P95_BUDGETS_MS` in
  [`k6/lib/config.js`](k6/lib/config.js). Tag every request with its `journey`, since the thresholds
  and the report are built from that tag. Model journeys on what a real client does in sequence,
  not on one endpoint in a loop.
- **Data.** Seeding through the API in `setup()` is simplest and keeps the script honest about what
  a client can do. When a journey needs thousands of rows, seed them from a script the runner calls
  before k6 starts instead, writing through the service's own repositories.
- **Datastores.** Add containers to [`docker-compose.perf.yml`](docker-compose.perf.yml) on a
  non-default loopback port, add the address to [`perf.env`](perf.env), and add the port and its
  `PERF_*` variable to `PORT_VARIABLES` in [`runnerOptions.ts`](runnerOptions.ts). For another
  database engine, add a reader to the probe (`readCockroachStats` is in the same package).
- **Upstream services.** Point their base URLs at a fake served on another loopback port, never at a
  shared environment. An unreachable address (`SAMPLE_FAKE_STORE_BASE_URL=http://localhost:1` here)
  is better than a real one: a journey that reaches it fails loudly instead of loading someone
  else's service.
- **Budgets.** The defaults are loose enough to pass on a laptop. Tighten them to just above what
  your service does today, so a regression fails the run.

## Troubleshooting

**`permission denied` writing `k6-report.md` with Docker k6.** The `grafana/k6` image runs as an
unprivileged user of its own. The runner pre-creates both output files world-writable for a Docker
run; if you run the image by hand, do the same or install k6 locally.

**`something already answers on :<port>`.** A `--keep` stack from earlier is still up: `node --run perf:down`.
If it is not, something else holds the port; move ours with the `PERF_*_PORT` variable.

**Every request fails with 401.** The service was started with a different key pair than the one in
`perf/.auth/`. Restart the stack; deleting `perf/.auth/` forces a new pair on the next bring-up.

**No profiles arrive.** Wait a minute after Pyroscope starts (it drops the first minute), check that
`perf/.logs/service.log` has `[PYROSCOPE] Continuous profiling started`, and widen the range
(`--from now-1h`). The [profiler README](https://github.com/lokalise/shared-ts-libs/tree/main/packages/app/pyroscope-profiling#when-no-profiles-arrive)
has the full checklist.

**Profiling on Windows.** The profiler's native binding cannot sample on Windows, so the runner
refuses `--profiling` there rather than hand back an empty flame graph. Run the stack from WSL2.

## Unit tests

The runner's option parsing, the auth helpers, and the k6 script's config and report are plain code
and are covered by the `*.spec.*` files here, which run with the rest of the suite (`pnpm test`). A
load run is far too slow to be the first place a parser bug shows up.

## No CI job

Local only. A load test on a shared CI runner measures the runner as much as the service. That
argument covers latency and nothing else: statement counts and check outcomes are deterministic
here, so a CI job that ran a smoke and asserted only those would be worth having, and is the shape
to add if you need one.
