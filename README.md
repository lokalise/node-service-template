# node-service-template

## Overview

`node-service-template` provides a "battery-included" starter template for building enterprise Node.js webservices.

It comes with the following out-of-the-box:

* [fastify](https://www.fastify.io/docs/latest/) as a basis for the general web application skeleton;
* Modular, domain-driven structure that encourages separation of concerns;
* Server/app separation, for convenient bootstrapping in e2e tests;
* [Global error handler](./src/infrastructure/errors/errorHandler.ts);
* JSON-based, single line standardized [logging](./src/infrastructure/logger.ts);
* Automatic population of `req.id` for incoming requests based on `x-request-id` header, or generation of new UUID if none is set, for the purposes of distributed tracing.

Mechanisms:

* Type-safe [config management](./src/infrastructure/config.ts);
* [Dependency injection](./docs/dependency-injection.md) (using [awilix](https://github.com/jeffijoe/awilix));
* [Scheduling](./docs/scheduling.md) (using [toad-scheduler](https://github.com/kibertoad/toad-scheduler)
  and [redis-semaphore](https://github.com/swarthy/redis-semaphore));
* Type-safe [dependency mocking](./src/app.mock.test.ts) for tests;

Scaffolding:

* [Background jobs](./src/infrastructure/AbstractBackgroundJob.ts);
* [Redis repositories](./src/infrastructure/redis);

Basic building block examples:

* [Repository](./src/modules/users/repositories/UserRepository.ts) (using [prisma](https://www.prisma.io/));
* [Domain service](./src/modules/users/services/UserService.ts);
* [Controller](./src/modules/users/controllers/UserController.ts);
* [Route](./src/modules/users/routes/userRoutes.ts);
* [Schema](./src/schemas/userSchemas.ts);
* [e2e test](./src/modules/users/controllers/UserController.e2e.spec.ts);

Plugins:

* Smart [healthcheck](./src/plugins/healthcheckPlugin.ts) plugin (using [fastify-custom-healthcheck](https://github.com/gkampitakis/fastify-custom-healthcheck));
* [JWT](./src/plugins/jwtTokenPlugin.ts) plugin (using [@fastify/jwt](https://github.com/fastify/fastify-jwt));

Scripts:

* [Generate](./scripts/generateOpenApi.ts) OpenAPI specification from your route definitions;
* [Validate](./scripts/validateOpenApi.ts) your OpenAPI specification.
* [GenerateJwt](./scripts/generateJwt.ts) generate jwt for dev usage.

Service template also comes with a curated set of plugins [installed](./src/app.ts):

* @fastify/helmet (security headers)
* @fastify/swagger (OpenAPI specification generation)
* @fastify/swagger-ui (visualizing OpenAPI specification)
* @fastify/awilix (dependency injection)
* @fastify/schedule (scheduling background jobs)
* @fastify/auth (authentication)
* fastify-graceful-shutdown (handling SEGTERM gracefully)
* fastify-no-icon (avoiding warnings when sending GET calls via browser)
* fastify-custom-healthcheck (registering app and dependency healthchecks)
* @lokalise/fastify-extras -> metricsPlugin (exposing Prometheus metrics)
* @lokalise/fastify-extras -> requestContextProviderPlugin (storing requestId in AsyncLocalStorage and populating
  requestContext on request)
* @lokalise/fastify-extras -> newRelicTransactionManagerPlugin (creating custom NewRelic spans for background jobs)
* @lokalise/fastify-extras -> bugsnagPlugin (reporting errors to BugSnag)
* @lokalise/fastify-extras -> prismaOtelTracingPlugin (generating OpenTelemetry metrics for DB operations using prisma)

Note that some of the fastify-extras plugins may not be relevant for you (e. g. if you are not using Prometheus, New
Relic or Bugsnag). In that case you should remove the plugins and delete everything that breaks when you attempt to
build the project.

We recommend you to create your own `@your-org/fastify-extras` package and create your own mix of vendor plugins that
are relevant for the technological stack of your organization, and replace `@lokalise/fastify-extras` with it.

## Getting Started

1. Install all project dependencies:

```shell
npm install
```

2. Copy the `.env.default` file to a new `.env` file. You can do this with the following npm script:

```shell
npm run copy:config
```

3. Run migrations to synchronize your database schema with defined models.

```shell
npm run db:migration:dev
```

4. Generate Prisma client for type-safe DB operations:

```shell
npm run db:update-client
```

5. You can use Docker Compose for launching all the infrastructural dependencies locally:

```shell
docker compose up -d
```

6. To run application:

```shell
npm run start:dev
```

### OpenAPI specification

You can access OpenAPI specification of your application, while it is running, by opening [SwaggerUI](http://localhost:3000/documentation) 

### Create jwt for dev usage

By default, all calls to the `node-template` app will require a valid JWT token.

You have multiple options to ease your development:
1. Comment `onRequest` hook for JWT verification [here](./src/plugins/jwtTokenPlugin.ts)
2. Generate a valid JWT with provided [generateJwt](./scripts/generateJwt.ts) script

#### Generate JWT script

- Script requires public-private key pair encrypted with `RS256` algorithm. 
Run it in [keys](./scripts/keys) directory.

```shell
ssh-keygen -t rsa -b 4096 -m PEM -f jwtRS256.key
# Don't add passphrase
openssl rsa -in jwtRS256.key -pubout -outform PEM -out jwtRS256.key.pub
````

or if you are in [node-service-template](.) dir

```shell
ssh-keygen -t rsa -b 4096 -m PEM -f ./scripts/keys/jwtRS256.key
# Don't add passphrase
openssl rsa -in ./scripts/keys/jwtRS256.key -pubout -outform PEM -out ./scripts/keys/jwtRS256.key.pub
```
- Default file names are `jwtRS256.key` for private key and `jwtRS256.key.pub` 
for public key
- Run JWT generate script 
```shell
npm run jwt:generate
```
- Copy your public key to `.env` file as a one line string, 
it will be printed with a token in console to make things easier.
Example output:
```
Public key: 
-----BEGIN PUBLIC KEY-----||MIICIjANBgkqhkiG9w0BAQEFAAOCAg8AMIICCgKCAgEAt+2fSaw+mjbQpbPYcGv7||A0zs+P1yuCcM4LzTRpMmtXCoxCg3hwVZUM9HoxM4NxSga5A/jdHDhn1qEgQF38cX||N/wG+cRx1YfxDV2fSYxO9ouh+0J+uJaAXs0kWM0oAojrcMI4q1PcTeCFBvKDR+ei||Nu5auiRe7yrBfQTqsSmvEDRlnhUnF24CnNQPuzeN4Qe8LmcXuwimEyAi9Tf7hXBN||H31j+jnUfIq9Yy7EsbmZhW3aEmQlmR6RY/9g+IEzbpmBoYznYsxmvtODpay7n+NY||zWtOdtJC9eKDaOs3wYjDR0G9uHe00ZIBiNfZWRGfTS/3+Sl9Yx8UesVpg8WqbkxC||LwAABtA5/WiKYxp3wsx4Qu9ooZwiE6tlgsb3hZAeusNODQ+rZsoiCowxNNfZ0fvj||veaBxDz7xB4t9fST9rsBJewPna3oFMlEPxigyv4ogFo60V9Ds6e8GHuYevSUeS34||BimjE2T0uE+HYatEmUY5tHRhTgBKP+Ty9dY2I9dpPDSl/nM63PmmbqSr7DIBreh4||pr3LwEPtffpaAY/YdQ0ypAVc7xuQMreTlzEsAFzbwnfI5eTT9oxZHBb1ulrnei1e||w6yxZ93j2UmCnaXPrTWsqyr/tXH4/sfLjqkY7Upj/zl7i0FlDAxtdv3qGg5Ozpj/||8OXPuK2d9Kv7C58uaVhO5bsCAwEAAQ==||-----END PUBLIC KEY-----||
JWT: 
eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJjbGFpbSI6InZhbHVlIiwiaWF0IjoxNjc2OTU4MDgwfQ.ssp6cX8Juv5a56VB-w4Nhdi1XmEyTsbPc9zBre2XylHnXvGdkx38GYYXAP9UDUAw4lkU7GE0FA8wlMitB3iFPKHLDWU8d-E1W0fV6GXAAngMMRrZeRCREYGx3FchEj8ufY4_7i4jGdA2ph8WOgrTqrpjJRjYYuClFYuCgH8QsRIeCnLo_UU3AhmqJ1FnUUXYK4lpk5ssvuUR3OZR4nexNZJEsIbL_584_FHc7duui7WMQ9fvBInNG4FRu3d2ZPC9RejAlV5sRk8H0HpLORM54h4SfeUXiapNnu7Td_in_3YmhdwBVugnxDdATUBMjHbSSjxn0UWCFD2whTxFOFS6rICGWhUMViRQ9fSljwiEaAkYGwRSOKB0McYXucYmxvjyBJo2ngFEGuymJi7Ow6cjNfri6BoiCoZwQfkvAzsrTYzR4lGV7lG7o4GpX4aoUTwnndvDtvxNzHtb4ssilfFFnvRQC63v9ybIRkIBhm9GaSepoPDw9lrblImnS13-WEPWy2l5_wIeYZUSPvlPIS3SV17b9ohGoNzk-axmB5QG1PvLYpZ2_t0z7h5od2vw5ZTPNOQ-RhNSu28REd4Mp0xHySYsn0ukf4kZHPUoGbMIuIMg6WhVTsz7V4n0nd1iPIjBfJjWM5dDSZfQvg4whwO1jeaE4BXxpjeiFqxf_tOT1QM
Verified payload: 
{"claim":"value","iat":1676958080}
```

- Use token from the console in your requests
