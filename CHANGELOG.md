# Changelog

## 11.09.2025

Smoketest script added into CI, now it will start an application and wait for the healthcheck to pass, and shutdown the application, or timeout in 15 seconds.

## 30.07.2025

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
