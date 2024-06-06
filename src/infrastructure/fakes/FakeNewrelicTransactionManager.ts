import { NewRelicTransactionManager } from '@lokalise/fastify-extras'

export class FakeNewrelicTransactionManager extends NewRelicTransactionManager {
  constructor() {
    super(false)
  }

  override addCustomAttribute(): void {}

  override start(): void {}

  override stop(): void {}
}
