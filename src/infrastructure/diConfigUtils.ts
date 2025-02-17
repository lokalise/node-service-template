export type DIOptions = {
  backgroundQueuesEnabled?: boolean | string[]
  enqueuedJobsEnabled?: boolean | string[]
  consumersEnabled?: boolean | string[]
  arePeriodicJobsEnabled?: boolean
}

export const resolveBackgroundQueuesEnabled = (options: DIOptions): boolean | string[] => {
  const { backgroundQueuesEnabled } = options
  if (!backgroundQueuesEnabled) return false
  if (Array.isArray(backgroundQueuesEnabled)) {
    return backgroundQueuesEnabled.length ? backgroundQueuesEnabled : false
  }

  return backgroundQueuesEnabled
}

export const isEnqueuedJobsEnabled = (options: DIOptions, name?: string): boolean =>
  isEnabled(options.enqueuedJobsEnabled, name)

export const isConsumerEnabled = (options: DIOptions, name?: string): boolean =>
  isEnabled(options.consumersEnabled, name)

const isEnabled = (option: boolean | string[] | undefined, name?: string): boolean => {
  return name && Array.isArray(option) ? option.includes(name) : !!option
}
