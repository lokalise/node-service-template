import { deserializeMessage } from './messageDeserializer'
import { Message } from 'amqplib'
import {
  PERMISSIONS_MESSAGE_SCHEMA,
  PERMISSIONS_MESSAGE_TYPE,
} from '../../modules/users/consumers/userConsumerSchemas'
import { ConsumerErrorResolver } from './ConsumerErrorResolver'

describe('messageDeserializer', () => {
  it('deserializes valid JSON', () => {
    const messagePayload: PERMISSIONS_MESSAGE_TYPE = {
      operation: 'add',
      userIds: [1],
      permissions: ['perm'],
    }
    const message: Message = {
      content: Buffer.from(JSON.stringify(messagePayload)),
    } as Message

    const errorProcessor = new ConsumerErrorResolver()

    const deserializedPayload = deserializeMessage(
      message,
      PERMISSIONS_MESSAGE_SCHEMA,
      errorProcessor,
    )

    expect(deserializedPayload.result).toMatchObject(messagePayload)
  })

  it('throws an error on invalid JSON', () => {
    const messagePayload: Partial<PERMISSIONS_MESSAGE_TYPE> = {
      userIds: [1],
    }
    const message: Message = {
      content: Buffer.from(JSON.stringify(messagePayload)),
    } as Message

    const errorProcessor = new ConsumerErrorResolver()

    const deserializedPayload = deserializeMessage(
      message,
      PERMISSIONS_MESSAGE_SCHEMA,
      errorProcessor,
    )

    expect(deserializedPayload.error).toMatchObject({
      errorCode: 'VALIDATION_ERROR',
    })
  })

  it('throws an error on non-JSON', () => {
    const message: Message = {
      content: Buffer.from('dummy'),
    } as Message

    const errorProcessor = new ConsumerErrorResolver()

    const deserializedPayload = deserializeMessage(
      message,
      PERMISSIONS_MESSAGE_SCHEMA,
      errorProcessor,
    )

    expect(deserializedPayload.error).toMatchObject({
      errorCode: 'AMQP_MESSAGE_INVALID_FORMAT',
    })
  })
})
