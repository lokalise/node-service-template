import { PermissionConsumer } from '../../modules/users/consumers/PermissionConsumer'
import { buildQueueMessage } from '../../utils/queueUtils'

import { AbstractQueueService } from './AbstractQueueService'
import type { CommonMessage } from './MessageTypes'

export abstract class AbstractPublisher<
  MessagePayloadType extends CommonMessage,
> extends AbstractQueueService<MessagePayloadType> {
  publish(message: MessagePayloadType): void {
    this.channel.sendToQueue(PermissionConsumer.QUEUE_NAME, buildQueueMessage(message))
  }
}