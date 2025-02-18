export type DIOptions = {
  enqueuedJobQueuesEnabled?: boolean | string[]
  enqueuedJobsEnabled?: boolean | string[]
  amqpConsumersEnabled?: boolean | string[]
  arePeriodicJobsEnabled?: boolean
}

export const resolveEnqueuedJobQueuesEnabled = (options: DIOptions): boolean | string[] => {
  const { enqueuedJobQueuesEnabled } = options
  if (!enqueuedJobQueuesEnabled) return false
  if (Array.isArray(enqueuedJobQueuesEnabled)) {
    return enqueuedJobQueuesEnabled.length ? enqueuedJobQueuesEnabled : false
  }

  return enqueuedJobQueuesEnabled
}

export const isEnqueuedJobsEnabled = (options: DIOptions, name?: string): boolean =>
  isEnabled(options.enqueuedJobsEnabled, name)

export const isAmqpConsumerEnabled = (options: DIOptions, name?: string): boolean =>
  isEnabled(options.amqpConsumersEnabled, name)

const isEnabled = (option: boolean | string[] | undefined, name?: string): boolean => {
  return name && Array.isArray(option) ? option.includes(name) : !!option
}
