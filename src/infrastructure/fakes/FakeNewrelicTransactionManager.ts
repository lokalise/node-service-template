import type { TransactionObservabilityManager } from '@lokalise/node-core'

export class FakeNewrelicTransactionManager implements TransactionObservabilityManager {
  start(): void {}

  stop(): void {}

  startWithGroup(): void {}

  addCustomAttributes(): void {}
}
