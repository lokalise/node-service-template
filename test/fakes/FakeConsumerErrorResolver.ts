import { ConsumerErrorResolver } from '../../src/infrastructure/amqp/ConsumerErrorResolver'

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
