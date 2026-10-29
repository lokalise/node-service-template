import type { InternalError } from '@lokalise/node-core'
import { AmqpConsumerErrorResolver } from '@message-queue-toolkit/amqp'

export class FakeConsumerErrorResolver extends AmqpConsumerErrorResolver {
  public handleErrorCallsCount: number
  constructor() {
    super()

    this.handleErrorCallsCount = 0
  }

  public override processError(error: unknown): InternalError {
    this.handleErrorCallsCount++
    return super.processError(error)
  }
}
