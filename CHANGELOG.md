# Changelog

## [1.12.1] - 2026-05-26

- Bump `@lokalise/opentelemetry-fastify-bootstrap` from `^2.2.0` to `^3.0.0`; v3 is a peer-dependency-only major (it now requires `@fastify/otel 0.18.1`, `@opentelemetry/auto-instrumentations-node ^0.76.0`, `@opentelemetry/sdk-node`/`exporter-trace-otlp-grpc ^0.218.0`, `@opentelemetry/sdk-trace-base ^2.7.1` — all already pinned here), with no public API changes to `initOpenTelemetry`/`gracefulOtelShutdown`

## [1.12.0] - 2026-05-26

- Bump all `package.json` dependencies to latest allowed by pnpm's `minimum-release-age` filter; notable major bumps: `amqplib` 1 → 2, `awilix-manager` 6 → 7, `toad-scheduler` 3 → 4, `@lokalise/backend-http-client` 10 → 11, `@lokalise/fastify-extras` 30 → 31, plus the OTel ecosystem (`@fastify/otel` 0.17.1 → 0.18.1, `@opentelemetry/exporter-trace-otlp-grpc` 0.210.0 → 0.218.0)
- Port `src/integrations/commonRetryConfig.ts` to the reshaped retry API in `@lokalise/backend-http-client@11` (`maxAttempts`/`delayResolver` → `maxRetries`/inline `delay` callback)
- Add `OTEL_CONSOLE_SPANS_ENABLED` env var to print OTel spans to stdout for local debugging; forced off in `src/server.ts` when `NODE_ENV=production` so span payloads never leak to stdout in deployed environments
- Add `src/infrastructure/openTelemetryBootstrap.spec.ts` — integration test that boots the real `getApp()` with an `InMemorySpanExporter` wired through `initOpenTelemetry`'s `spanProcessors` option, asserts the top-level `@fastify/otel` `request` span is emitted with the expected `http.*` attributes (uses `vi.waitFor` to avoid timing flakiness)
- Add `src/integrations/commonRetryConfig.spec.ts` covering the inline `delay` function
- Add `@opentelemetry/sdk-trace-base` as a devDependency (for `InMemorySpanExporter` / `SimpleSpanProcessor`)
- Mark `protobufjs` as `allowBuilds: false` in `pnpm-workspace.yaml` (matches the existing `msw` opt-out pattern) for the new transitive build script
- Align `packages/api-contracts/package.json` peerDependencies with devDependencies (`@lokalise/api-contracts ^6.11.0`, `zod ^4.4.3`)

## [1.11.0] - 2026-05-24

- Bump minimum Node.js to `>=24.16.0` and Docker base image to `node:24.16.0-trixie-slim` to pick up native `crypto.randomUUIDv7` (Node 24.16+)
- Replace `generateUuid7` from `@lokalise/id-utils` with native `crypto.randomUUIDv7` in `src/db/schema/{user,post}.ts` and the affected specs; replace `generateMonotonicUuid` with `randomUUIDv7` for the per-invocation CLI request id in `scripts/utils/cliCommandWrapper.ts`
- Drop `@lokalise/id-utils` as a direct dependency (still pulled transitively via `@lokalise/background-jobs-common`)
- Add `src/types/node-crypto.d.ts` ambient declaration for `crypto.randomUUIDv7` until `@types/node` ships the typing; bump `@types/node` to `^25.9.1`
- Bump `packageManager` from `pnpm@10.18.2` to `pnpm@11.2.2`; pnpm 11 auto-added an `allowBuilds:` entry for `msw` in `pnpm-workspace.yaml` that needs an explicit `true`/`false`
- Refresh `README.md` to state `node >= 24` (was stale `node >= 22`)

## [1.10.0] - 2026-04-28

- Upgrade OpenAPI spec to 3.1.0 and set `zodToJsonConfig.target` to `draft-2020-12` in `createJsonSchemaTransform`; fixes nullable objects and arrays being incorrectly described in Scalar API reference docs

## [1.9.0] - 2026-04-23

- Add a dedicated Biome config for workspace packages: root `biome.jsonc` is now `root: true` and excludes `packages`; new `packages/biome.jsonc` is an independent root extending `biome-base`, `biome-esm`, and `biome-package`
- Add `lint`/`lint:fix` scripts to `packages/api-contracts` (`biome check && tsc`) and chain them from the root `lint`/`lint:fix` via `pnpm --filter "./packages/*"` so workspace packages are linted and type-checked in CI alongside the service

## [1.8.0] - 2026-04-23

- Make graceful shutdown timeout configurable via `GRACEFUL_SHUTDOWN_TIMEOUT_MS` env var (default: `10000`,  maximum `30000`; values above the maximum fail validation at startup), replacing the hardcoded constant in `app.ts`

## [1.7.0] - 2026-04-21

- Migrate package manager from npm to pnpm (lockfile, CI, Dockerfile, dependabot config, README, CODEOWNERS updated); `package-lock.json` replaced by `pnpm-lock.yaml`
- Introduce pnpm workspace with `@node-service-template/api-contracts` package under `packages/api-contracts/` (extracted user API contracts and schemas; consumed by the service via `workspace:*`)
- Add `build:contracts` script and run it before `start:dev`/`start:dev:watch` so the contracts package's `dist/` is available at runtime
- Add `@opentelemetry/instrumentation` as an explicit dependency so the `--import=@opentelemetry/instrumentation/hook.mjs` runtime hook resolves under pnpm's strict isolation
- Add `@lokalise/zod-extras` as a direct service dependency to satisfy the api-contracts package's peer dependency when running `pnpm install --prod` in the Docker production-deps stage
- Point the api-contracts package's runtime `exports` at `./dist/index.js` (types remain on `./src/index.ts` for the workspace so type-checking needs no prior build; `publishConfig` narrows types to `dist` on publish)

## [1.6.0] - 2026-04-20

- Migrate AWS config to `envase` `createConfig` with computed schema (`getEnvaseAwsConfig({ path: 'aws' })` now exposes `schema`/`computed`, and `Config.aws` is typed as `AwsConfig`)
- Make container port configurable via `APP_PORT` env var in `Dockerfile` (healthcheck and `EXPOSE` now honor the override)
- Bump Node base image to `24.15.0-trixie-slim`
- Update dependencies across aws, drizzle, biomejs, vitest, awilix, and types groups; notable bumps include `opinionated-machine` 6.10.1 → 6.13.2, `@lokalise/api-contracts` 6.5.3 → 6.8.0, `@scalar/fastify-api-reference` 1.44.26 → 1.49.8, `bullmq` 5.70.0 → 5.72.0, `postgres` 3.4.8 → 3.4.9, `undici` 7.24.5 → 7.25.0, `ioredis` 5.9.3 → 5.10.1, `redis-semaphore` 5.6.2 → 5.7.0, plus dev-only bumps to `@readme/openapi-parser` 5.5.0 → 6.0.1 and `mockttp` 4.2.3 → 4.3.1

## [1.5.1] - 2026-03-25

- Add Docker build and healthcheck test script (`scripts/docker-healthcheck-test.sh`)
- Add conditional GitHub Actions workflow that validates the Docker image on Dockerfile changes
- Add Docker-compatible env file (`.env.docker-test`) for container-based testing

## [1.5.0] - 2026-02-22

- Replace LocalStack with [fauxqs](https://github.com/kibertoad/fauxqs) for local AWS service emulation (SQS/SNS)
- Add `AbstractSnsSqsConsumer` base class mirroring `AbstractRabbitMQTopicConsumer` pattern
- Add `sqsClient`, `snsClient`, `stsClient`, and `snsConsumerErrorResolver` DI registrations
- Add sample `UserEventConsumer` (SNS->SQS) with `user.created` event handler
- Add fauxqs test helper for embedded library mode in tests

## [1.4.0] - 2026-02-16

- Migrate to new `opinionated-machine` DI patterns: `PublicDependencies` module augmentation, `InferModuleDependencies`, `InferPublicModuleDependencies`
- Migrate to unified `buildRestContract` from `@lokalise/api-contracts` (replaces `buildGetRoute` and other method-specific builders)
- Migrate to unified `sendByContract` from `@lokalise/backend-http-client` (replaces `sendByGetRoute` and other method-specific senders)
- Migrate to unified `buildFastifyRoute` and `injectByContract` from `@lokalise/fastify-api-contracts` (replaces `buildFastifyPayloadRoute`/`buildFastifyNoPayloadRoute` and `injectGet`/`injectPost`/`injectPatch`/`injectDelete`)
- Update `awilix` to v13, `opinionated-machine` to v6.10

## [1.3.4] - 2026-01-29
 - Add missing `unhandledExceptionPlugin`
 - Remove the error folder and replace it with `node-core`
 - Clean up unused dependencies

## [1.3.3] - 2026-01-28

Skip request logging for utility endpoints

## [1.3.2] - 2026-01-28

Switch to 1.0.0 beta drizzle

## [1.3.1] - 2026-01-28

Migrate envvars management to envase.

## [1.3.0] - 2026-01-27

* Use newer version of OTel instrumentation setup

* Remove New Relic instrumentation

* Add optionalDependencies to ensure consistent lockfile regeneration

* Update dependencies

## [1.2.3] - 2026-01-27

Remove passing '-' as JWT secret private key to utilize Verify-only mode.

## [1.2.2] - 2026-01-19

Move OpenAPI spec validation to e2e test.

## [1.2.1] - 2026-01-19

Improve error logging.

## [1.2.0] - 2025-09-17

Remove promise wrappers from healthchecks that already relied on synchronous storage, populated asynchronously. This reduces the overhead of healthcheck endpoint and works more reliably in a heavily loaded sytem.

## [1.1.0] - 2025-09-17

Smoketest script added into CI, now it will start an application and wait for the healthcheck to pass, and shutdown the application, or timeout in 15 seconds.

## [1.0.0] - 2025-07-30

### Changes

`@lokalise/healthcheck-utils` `v4.0.1` -> `v5.1.0`

With this update, we simplified the work with healthcheck wrappers.

Before the wrapper looked like this:

 ```typescript
 export const redisHealthCheck: HealthChecker = (
    app: FastifyInstance,
): Promise<Either<Error, true>> => {
    const checkResult = app.diContainer.cradle.healthcheckStore.getHealthcheckResult('redis')

    if (checkResult === false) {
        return Promise.resolve({
            error: new Error('Redis healthcheck not positive in store'),
        })
    }
    return Promise.resolve({ result: true })
}
```

The new wrapper looks like this:
```typescript
export const redisHealthCheck: HealthChecker = (
    app: FastifyInstance,
): Promise<Either<Error, true>> => {
    return app.diContainer.cradle.healthcheckStore.getAsyncHealthCheckResult('redis')
}
```

To migrate, you need to replace `getHealthcheckResult` with `getAsyncHealthCheckResult` in your healthcheck wrappers.

Another thing that comes with this update is that now the `getHealthcheckResult` internally doesn't return only `true/false`, but also an error if the healthcheck failed. This means that you can now return a more descriptive error message in your healthcheck wrappers.
