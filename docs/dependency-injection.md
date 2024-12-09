# Dependency injection

## Overview

Dependencies are managed using [awilix](https://github.com/jeffijoe/awilix) and [awilix-manager](https://github.com/kibertoad/awilix-manager).

### Configuration

You can find configuration for the dependencies in [parentDiConfig.ts](../src/infrastructure/parentDiConfig.ts).

When adding a new module, you have to create a new diConfig for it (e.g. [userDiConfig.ts](../src/modules/users/userDiConfig.ts)) that:

1. Exposes a method to resolve the new dependencies:

```ts
export function resolveUsersConfig(options: DIOptions): UsersDiConfig {
  return {
    userService: asClass(UserService, SINGLETON_CONFIG),
  }
}
```

2. Adds new fields to the DiConfig interface:

```ts
export type UsersModuleDependencies = {
  userService: UserService
}

// dependencies injectable within the module
export type UsersInjectableDependencies = UsersModuleDependencies & CommonDependencies

// dependencies injectable across different modules
export type UsersPublicDependencies = Pick<UsersInjectableDependencies, 'userService'>
```

Additionally, the new resolver should be added to the [parentDiConfig.ts](../src/infrastructure/parentDiConfig.ts):

```ts
const diConfig: DiConfig = {
  ...resolveCommonDiConfig(dependencies, options),
  ...resolveUsersConfig(options),
}
```

### Resolve dependencies

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
drizzle: asFunction(
        ({ config }: CommonDependencies) => {
          const pg = postgres(config.db.databaseUrl)
          return drizzle(pg)
        },
        {
          dispose: (drizzle) => drizzle.$client.end(),
          lifetime: Lifetime.SINGLETON,
        },
),
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
  const { drizzle, redis } = fastify.diContainer.cradle
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
