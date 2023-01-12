# Dependency injection

## Overview

Dependencies are managed using [awilix](https://github.com/jeffijoe/awilix).

### Configuration

You can find configuration for the dependencies in [diConfig.ts](../src/infrastructure/diConfig.ts).

When adding a new module, you have to update two places:

1. Add new resolver to diConfig:

```ts
const diConfig: DiConfig = {
  userRepository: asClass(UserRepository, SINGLETON_CONFIG),
}
```

2. Add new field to the DiConfig interface:

```ts
export interface Dependencies {
  userRepository: UserRepository
}
```

In order to make a class a module, you have to implement a constructor which accepts `dependencies: Dependencies` as its
only constructor parameter (`asClass` definition).
Example:

```ts
export class UserService {
  private readonly userRepository: UserRepository

  constructor({ userRepository }: Dependencies) {
    this.userRepository = userRepository
  }
}
```

Alternatively, you can instantiate a module yourself inside a function that accepts `dependencies: Dependencies` as its
only parameter (`asFunction` definition).
Example:

```ts
;({ config }: Dependencies) => {
  return new PrismaClient({
    datasources: {
      db: {
        url: config.db.databaseUrl,
      },
    },
  })
}
```

### Injection

Declared dependencies can be injected from the request, application, or globally:

```ts
import { diContainer } from '@fastify/awilix'

// accessing the DI context on the request
export const postCreateUser = async (req: FastifyRequest, reply: FastifyReply) => {
  const { userService } = req.diScope.cradle
}

// accessing the DI context on the app
function plugin(fastify: FastifyInstance, opts: unknown, done: () => void) {
  const { prisma, redis } = fastify.diContainer.cradle
  done()
}

// accessing the DI context globally
const { userService } = diContainer.cradle
```

## Notable details

- All dependencies are lazily resolved whenever first requested either via cradle, or as a dependency for some other
  module;
- All dependencies are resolved synchronously, all asynchronous activation logic needs to be implemented separately;
- You should define a `dispose` function in DI options for the module if it has some resources to cleanup (e. g. a DB
  connection);

## Mocking the dependencies

For testing purposes you can override any modules in the dependency graph.

When instantiating full app in a test:

```ts
import { getApp } from './app'

let app: FastifyInstance
beforeAll(async () => {
  app = await getApp(
    {},
    // All dependencies passed here will replace the real ones
    {
      userService: asClass(FakeUserService, SINGLETON_CONFIG),
    },
  )
})
```

When instantiating just the test context:

```ts
import { createTestContext } from '../../../../test/TestContext'

let testContext: TestContext
beforeAll(async () => {
  testContext = createTestContext(
    // All dependencies passed here will replace the real ones
    {
      userService: asClass(FakeUserService, SINGLETON_CONFIG),
    },
  )
})
```
