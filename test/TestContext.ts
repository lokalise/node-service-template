import type { Config } from "../src/infrastructure/config.js";
import { getConfig } from '../src/infrastructure/config.js'
import { AbstractTestContextFactory, type DIContext } from "opinionated-machine";
import { CommonModule, type Dependencies, type ExternalDependencies } from "../src/infrastructure/CommonModule.js";
import type { AppInstance } from "../src/app";
import { NewRelicTransactionManager } from "@lokalise/fastify-extras";
import { AwilixManager } from "awilix-manager";
import { createContainer } from "awilix";
import { UserModule } from "../src/modules/users/UserModule";
import { globalLogger } from "@lokalise/node-core";

export type TestContext = DIContext<Dependencies, ExternalDependencies>

class TestContextFactory extends AbstractTestContextFactory<Dependencies, ExternalDependencies, Config> {
  constructor() {
    const diContainer = createContainer({
      injectionMode: 'PROXY',
    });

    const awilixManager = new AwilixManager({
      diContainer,
      asyncDispose: true,
      asyncInit: true,
      eagerInject: true,
    })

    const fakeApp: Partial<AppInstance> = {
      newrelicTransactionManager: NewRelicTransactionManager.createDisabled(),
      awilixManager,
    }

    super({
      app: fakeApp,
      logger: globalLogger,
    }, [new CommonModule(), new UserModule()], diContainer)
  }

  resolveBaseAppConfig() {
    return getConfig()
  }
}

export const testContextFactory = new TestContextFactory()
