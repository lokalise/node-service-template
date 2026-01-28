# Changelog

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
