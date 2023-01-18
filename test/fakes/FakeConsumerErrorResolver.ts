import { ConsumerErrorResolver } from '../../src/infrastructure/amqp/ConsumerErrorResolver'
import { InternalError } from '@lokalise/node-core'

export class FakeConsumerErrorResolver extends ConsumerErrorResolver {
  public handleErrorCallsCount: number
  constructor() {
    super()

    this.handleErrorCallsCount = 0
  }

  public override processError(error: unknown) {
    this.handleErrorCallsCount++
    return super.processError(error)
  }
}
