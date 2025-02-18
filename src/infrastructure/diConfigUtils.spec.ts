import { describe, expect, it } from 'vitest'

import {
  isAmqpConsumerEnabled,
  isEnqueuedJobsEnabled,
  resolveBackgroundQueuesEnabled,
} from './diConfigUtils.js'

describe('diConfigUtils', () => {
  describe('resolveBackgroundQueuesEnabled', () => {
    it('returns true when backgroundQueuesEnabled is true', () => {
      expect(resolveBackgroundQueuesEnabled({ backgroundQueuesEnabled: true })).toBeTruthy()
    })

    it('returns false when backgroundQueuesEnabled is false', () => {
      expect(resolveBackgroundQueuesEnabled({ backgroundQueuesEnabled: false })).toBeFalsy()
    })

    it('returns false when backgroundQueuesEnabled is undefined', () => {
      expect(resolveBackgroundQueuesEnabled({})).toBeFalsy()
    })

    it('returns false when backgroundQueuesEnabled is an empty array', () => {
      expect(resolveBackgroundQueuesEnabled({ backgroundQueuesEnabled: [] })).toBeFalsy()
    })

    it('returns array when backgroundQueuesEnabled is a valid array', () => {
      expect(resolveBackgroundQueuesEnabled({ backgroundQueuesEnabled: ['e1', 'e2'] })).toEqual([
        'e1',
        'e2',
      ])
    })
  })

  describe('isEnqueuedJobsEnabled', () => {
    it('returns true when enqueuedJobsEnabled is true', () => {
      expect(isEnqueuedJobsEnabled({ enqueuedJobsEnabled: true })).toBeTruthy()
    })

    it('returns false when enqueuedJobsEnabled is false', () => {
      expect(isEnqueuedJobsEnabled({ enqueuedJobsEnabled: false })).toBeFalsy()
    })

    it('returns false when enqueuedJobsEnabled is undefined', () => {
      expect(isEnqueuedJobsEnabled({})).toBeFalsy()
    })

    it('returns false when enqueuedJobsEnabled is an array that includes the queue name', () => {
      expect(isEnqueuedJobsEnabled({ enqueuedJobsEnabled: ['e1', 'e2'] }, 'e1')).toBeTruthy()
    })

    it('returns false when enqueuedJobsEnabled is an array that does not include the queue name', () => {
      expect(isEnqueuedJobsEnabled({ enqueuedJobsEnabled: ['e1', 'e2'] }, 'e3')).toBeFalsy()
    })
  })

  describe('isAmqpConsumerEnabled', () => {
    it('returns true when amqpConsumersEnabled is true', () => {
      expect(isAmqpConsumerEnabled({ amqpConsumersEnabled: true })).toBeTruthy()
    })

    it('returns false when amqpConsumersEnabled is false', () => {
      expect(isAmqpConsumerEnabled({ amqpConsumersEnabled: false })).toBeFalsy()
    })

    it('returns false when amqpConsumersEnabled is undefined', () => {
      expect(isAmqpConsumerEnabled({})).toBeFalsy()
    })

    it('returns true when amqpConsumersEnabled is an array that includes the job name', () => {
      expect(isAmqpConsumerEnabled({ amqpConsumersEnabled: ['e1', 'e2'] }, 'e1')).toBeTruthy()
    })

    it('returns false when amqpConsumersEnabled is an array that does not include the job name', () => {
      expect(isAmqpConsumerEnabled({ amqpConsumersEnabled: ['e1', 'e2'] }, 'e3')).toBeFalsy()
    })
  })
})
