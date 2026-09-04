# Deployment

This document describes the runtime contract of the service: how the container starts, how it reports health, how it
stops, and what it expects from its environment.

It deliberately contains no manifests, charts or pipeline definitions. Deployment topology is specific to the platform
you run on, and any example we shipped here would be wrong for most consumers and stale within a release. What is
described below is the part that this codebase actually determines, which is also the part that is easiest to get wrong.

## Image

The image is built from [Dockerfile](../Dockerfile) in the repository root. The release stage:

- is based on `node:24.17.0-trixie-slim`;
- runs as the unprivileged `node` user (uid 1000), with the working directory `/home/node/app`;
- has `dumb-init` as PID 1, which forwards `SIGTERM` and `SIGINT` to the Node process. If you override the entrypoint or
  command, keep an init that forwards signals, otherwise graceful shutdown never runs and the process is killed
  outright;
- contains production dependencies only. Dev dependencies are not installed in the release stage.

Two build arguments are baked into the image as environment variables and reported by the healthcheck endpoints:

```shell
docker build --build-arg GIT_COMMIT_SHA="$(git rev-parse HEAD)" --build-arg APP_VERSION=1.2.3 .
```

Without them the healthcheck response says `COMMIT_SHA_NOT_SET` and `VERSION_NOT_SET`, which makes "which build is
actually running" unanswerable during an incident. Pass them.

As shipped, the service writes nothing to the filesystem at runtime, so it can run with a read-only root filesystem.

## Ports

| Port                  | Serves                          | Enabled when             |
| --------------------- | ------------------------------- | ------------------------ |
| `APP_PORT` (`3000`)   | HTTP API, healthcheck endpoints | always                   |
| `9080`                | Prometheus `/metrics`           | `METRICS_ENABLED=true`   |

Both listeners bind to `APP_BIND_ADDRESS`, which must be `0.0.0.0` in a container. The metrics port is fixed in
`@lokalise/fastify-extras` and is not configurable through the environment. Keep it off any public route.

## Health endpoints

| Path      | Purpose            | Checks                   | Response                                                              |
| --------- | ------------------ | ------------------------ | --------------------------------------------------------------------- |
| `/live`   | Liveness           | none                     | `200 {"status":"OK"}` whenever the process can serve HTTP              |
| `/health` | Readiness          | Postgres, Redis          | `200` when healthy, `500` when a mandatory check fails; includes per-check results, `version` and `gitCommitSha` |
| `/`       | Public heartbeat   | Postgres, Redis          | same status codes as `/health`, without the per-check detail          |

All three are unauthenticated (they are in the [JWT plugin](../src/plugins/jwtTokenPlugin.ts) skip list). `/health`
discloses the running version, the commit SHA and the names of the service dependencies, so keep it on an internal
route and use `/` for anything reachable from outside.

Rules that matter:

- Point liveness at `/live` and nothing else. `/live` checks the process, not its dependencies. If liveness points at
  `/health`, a transient Redis or Postgres outage restarts every replica simultaneously and turns a dependency blip
  into an outage of your own. The `HEALTHCHECK` in the Dockerfile already uses `/live`.
- Point readiness at `/health`. A replica that cannot reach Postgres or Redis should stop receiving traffic without
  being killed.
- There is no `/ready` route. The string appears in the OpenTelemetry skip list in [server.ts](../src/server.ts), but no
  handler is registered for it, so a probe pointed there gets a 404.
- A startup probe is usually unnecessary. The HTTP listener opens only after `app.ready()` resolves, so the port does
  not accept connections until dependency injection, plugins, consumers and jobs are wired up. If your own dependencies
  make boot slow, prefer `/live` with a generous failure threshold over a long initial delay.

## Startup sequence

1. The OpenTelemetry SDK is initialised first, before any other module is loaded, unless `OTEL_ENABLED=false`.
2. Configuration is parsed and validated ([config.ts](../src/infrastructure/config.ts)). Missing or invalid environment
   variables throw here, and the process exits with a non-zero code before the port is opened.
3. The DI container is built, and queues, consumers and periodic jobs are registered.
4. `app.ready()` resolves.
5. The server listens on `APP_BIND_ADDRESS:APP_PORT`. A failure to bind is logged and exits with code 1.

A misconfigured environment therefore produces a crash loop, not a pod that accepts traffic and fails every request.
That is intentional: configuration errors should be visible at deploy time.

## Shutdown

Graceful shutdown is handled by `fastify-graceful-shutdown`, which is registered only when `NODE_ENV` is not
`development`. On `SIGTERM` or `SIGINT`:

1. The app-scoped `AbortController` is aborted, so long-running work wired to `appAbortController.signal` can
   short-circuit.
2. OpenTelemetry is flushed and shut down.
3. `fastify.close()` runs: no new connections are accepted, in-flight requests are allowed to finish, the DI container
   is disposed, the scheduler is stopped and its job locks released, and the metrics server is closed.
4. The process exits with code 0.

If that does not complete within `GRACEFUL_SHUTDOWN_TIMEOUT_MS` (default `10000`, capped at `30000`), the process is
terminated with exit code 1.

The part that trips people up: the application starts closing as soon as `SIGTERM` arrives. It does not keep answering
readiness checks while it drains. On Kubernetes, endpoint removal and pod termination happen concurrently, so a replica
can still receive new connections for a short window after it has been signalled. Give the routing layer time to
converge before the process starts refusing connections:

- add a `preStop` hook that sleeps for a few seconds (the equivalent on other platforms is whatever connection-draining
  delay the router offers);
- set `terminationGracePeriodSeconds` higher than the `preStop` delay plus `GRACEFUL_SHUTDOWN_TIMEOUT_MS`, otherwise
  the orchestrator sends `SIGKILL` in the middle of the drain.

One more consequence of the plugin set: `unhandledExceptionPlugin` is registered with `shutdownAfterHandling: false`.
Unhandled exceptions and rejections are logged and reported to the error reporter, but they do not terminate the
process. Do not rely on restart-on-crash to clear a bad internal state, and alert on the logged errors instead.

## Configuration

All configuration comes from environment variables. There are no config files to mount. The full list is generated from
the config schema and lives in [environment-variables.md](./environment-variables.md); `node --run docs:generate`
regenerates it and `docs:validate` runs as part of linting, so it does not drift.

Points that affect how you wire secrets and environments:

- Secrets: `DATABASE_URL` (it embeds the password), `REDIS_PASSWORD`, `SCHEDULER_REDIS_PASSWORD`, `AMQP_PASSWORD`,
  `AWS_SECRET_ACCESS_KEY`, `BUGSNAG_KEY`, `AMPLITUDE_KEY`. Everything else is plain configuration.
- `JWT_PUBLIC_KEY` is a PEM document. The config layer replaces `||` with newlines, so the key can be passed as a single
  line through secret stores that do not preserve them. Literal newlines work too.
- `NODE_ENV` is fixed to `production` in the image and controls framework behaviour. `APP_ENV`
  (`production` / `staging` / `development`) is what tells the service which deployment environment it is running in,
  and it is reported as the Bugsnag release stage. Set both correctly; they are not interchangeable.
- `APP_VERSION` and `GIT_COMMIT_SHA` are build-time arguments, not runtime configuration.

## Database migrations

`drizzle-kit` is a production dependency, and the release image contains both the compiled config and the migration
files, so migrations run from the same image as the service:

```shell
node_modules/.bin/drizzle-kit migrate --config=./db/drizzle.config.js
```

Run it from the image working directory (`/home/node/app`). Drizzle resolves the migrations folder relative to the
process working directory, not relative to the config file, and the Dockerfile copies migrations to
`src/db/migrations` to match.

- Run migrations as a single pre-rollout step: a job, a release task, a one-shot container. Do not use an init
  container, since that runs one migrator per replica, all racing on the same schema at the same time.
- The migration step needs the same environment as the service, not just `DATABASE_URL`. The compiled config module
  calls `getConfig()`, so the full schema is validated before drizzle connects.
- During a rolling deploy the previous and the new release run simultaneously. Migrations must be backward compatible
  with the release they are replacing: add columns before the code that writes them, and drop columns a release after
  the code that read them is gone.

## Running multiple replicas

The HTTP layer is stateless. The same process also runs background work, which behaves as follows when replicated:

- Periodic jobs ([AbstractPeriodicJob](../src/infrastructure/jobs/AbstractPeriodicJob.ts)) default to
  `singleConsumerMode`, which takes a Redis mutex, so exactly one replica executes a given job per interval. See
  [scheduling.md](./scheduling.md).
- Enqueued jobs (BullMQ) and message queue consumers are pull-based, so replicas share the work.

Horizontal scaling is therefore safe out of the box. Anything you add that must run exactly once needs its own lock.

## One-off commands

[cli-commands.md](./cli-commands.md) describes how to write maintenance commands that run with the full DI container
outside the HTTP server.

They are not available in the released image as things stand: the release stage copies `dist`, `node_modules`,
`packages` and `src/db/migrations`, and commands live in `scripts/cmd`. If you need to run maintenance tasks in a
deployed environment, move the commands under `src/` so they are compiled into `dist/`, and invoke them as
`node <command>.js` in a one-shot container.

## Resource sizing

This template publishes no reference figures, because they depend entirely on what you build on top of it. Measure your
own service under a representative load before setting requests and limits.

Two things worth knowing when you do:

- Node sizes its default heap from the memory it believes is available, and it does not reliably observe a container
  memory limit. If you set a memory limit, set the heap explicitly as well, for example
  `NODE_OPTIONS=--max-old-space-size=768` for a 1 GiB limit, so V8 collects garbage before the container is OOM-killed.
- OpenTelemetry instrumentation carries a baseline memory and CPU cost. If you do not export traces, set
  `OTEL_ENABLED=false` rather than leaving the SDK running with no exporter.

## Related documents

- [service-release-checklist.md](./service-release-checklist.md) covers what a service needs before it goes to
  production, beyond the runtime contract described here.
- [environment-variables.md](./environment-variables.md) is the generated configuration reference.
- [logging.md](./logging.md) describes the log format that your log pipeline will receive.
