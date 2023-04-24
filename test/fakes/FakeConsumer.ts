import type { Either } from '@lokalise/node-core'
import type { ZodType } from 'zod'

import { AbstractConsumer } from '../../src/infrastructure/amqp/AbstractConsumer'
import type { CommonMessage } from '../../src/infrastructure/amqp/MessageTypes'
import type { Dependencies } from '../../src/infrastructure/diConfig'

export class FakeConsumer extends AbstractConsumer<CommonMessage> {
  constructor(dependencies: Dependencies, queueName = 'dummy', messageSchema: ZodType) {
    super(
      {
        queueName: queueName,
        messageSchema,
      },
      dependencies,
    )
  }

  processMessage(): Promise<Either<'retryLater', 'success'>> {
    return Promise.resolve({
      result: 'success',
    })
  }
}
