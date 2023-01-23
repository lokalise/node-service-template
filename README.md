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
