import { NewRelicTransactionManager } from '@lokalise/fastify-extras'

export class FakeNewrelicTransactionManager extends NewRelicTransactionManager {
  constructor() {
    super(false)
  }

  addCustomAttribute(): void {}

  start(): void {}

  stop(): void {}
}
