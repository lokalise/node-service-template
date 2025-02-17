import { describe, expect, it } from 'vitest'

import {
  isConsumerEnabled,
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

  describe('isConsumerEnabled', () => {
    it('returns true when consumersEnabled is true', () => {
      expect(isConsumerEnabled({ consumersEnabled: true })).toBeTruthy()
    })

    it('returns false when consumersEnabled is false', () => {
      expect(isConsumerEnabled({ consumersEnabled: false })).toBeFalsy()
    })

    it('returns false when consumersEnabled is undefined', () => {
      expect(isConsumerEnabled({})).toBeFalsy()
    })

    it('returns true when consumersEnabled is an array that includes the job name', () => {
      expect(isConsumerEnabled({ consumersEnabled: ['e1', 'e2'] }, 'e1')).toBeTruthy()
    })

    it('returns false when consumersEnabled is an array that does not include the job name', () => {
      expect(isConsumerEnabled({ consumersEnabled: ['e1', 'e2'] }, 'e3')).toBeFalsy()
    })
  })
})
