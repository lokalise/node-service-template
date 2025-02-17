import { describe, expect, it } from 'vitest'

import {
  isAmqpConsumerEnabled,
  isBullmqProcessorEnabled,
  resolveBullmqQueuesEnabled,
} from './diConfigUtils.js'

describe('diConfigUtils', () => {
  describe('resolveBullmqQueuesEnabled', () => {
    it('returns true when resolveBullmqQueuesEnabled is true', () => {
      expect(resolveBullmqQueuesEnabled({ bullmqQueuesEnabled: true })).toBeTruthy()
    })

    it('returns false when resolveBullmqQueuesEnabled is false', () => {
      expect(resolveBullmqQueuesEnabled({ bullmqQueuesEnabled: false })).toBeFalsy()
    })

    it('returns false when resolveBullmqQueuesEnabled is undefined', () => {
      expect(resolveBullmqQueuesEnabled({})).toBeFalsy()
    })

    it('returns false when resolveBullmqQueuesEnabled is an empty array', () => {
      expect(resolveBullmqQueuesEnabled({ bullmqQueuesEnabled: [] })).toBeFalsy()
    })

    it('returns array when resolveBullmqQueuesEnabled is a valid array', () => {
      expect(resolveBullmqQueuesEnabled({ bullmqQueuesEnabled: ['e1', 'e2'] })).toEqual([
        'e1',
        'e2',
      ])
    })
  })

  describe('isBullmqProcessorEnabled', () => {
    it('returns true when bullmqProcessorsEnabled is true', () => {
      expect(isBullmqProcessorEnabled({ bullmqProcessorsEnabled: true })).toBeTruthy()
    })

    it('returns false when bullmqProcessorsEnabled is false', () => {
      expect(isBullmqProcessorEnabled({ bullmqProcessorsEnabled: false })).toBeFalsy()
    })

    it('returns false when bullmqProcessorsEnabled is undefined', () => {
      expect(isBullmqProcessorEnabled({})).toBeFalsy()
    })

    it('returns false when bullmqProcessorsEnabled is an array that includes the queue name', () => {
      expect(isBullmqProcessorEnabled({ bullmqProcessorsEnabled: ['e1', 'e2'] }, 'e1')).toBeTruthy()
    })

    it('returns false when bullmqProcessorsEnabled is an array that does not include the queue name', () => {
      expect(isBullmqProcessorEnabled({ bullmqProcessorsEnabled: ['e1', 'e2'] }, 'e3')).toBeFalsy()
    })
  })

  describe('isAmqpConsumerEnabled', () => {
    it('returns true when sqsConsumersEnabled is true', () => {
      expect(isAmqpConsumerEnabled({ amqpConsumersEnabled: true })).toBeTruthy()
    })

    it('returns false when sqsConsumersEnabled is false', () => {
      expect(isAmqpConsumerEnabled({ amqpConsumersEnabled: false })).toBeFalsy()
    })

    it('returns false when sqsConsumersEnabled is undefined', () => {
      expect(isAmqpConsumerEnabled({})).toBeFalsy()
    })

    it('returns true when sqsConsumersEnabled is an array that includes the job name', () => {
      expect(isAmqpConsumerEnabled({ amqpConsumersEnabled: ['e1', 'e2'] }, 'e1')).toBeTruthy()
    })

    it('returns false when sqsConsumersEnabled is an array that does not include the job name', () => {
      expect(isAmqpConsumerEnabled({ amqpConsumersEnabled: ['e1', 'e2'] }, 'e3')).toBeFalsy()
    })
  })
})
