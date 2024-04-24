const isEnabled = (option: boolean | string[] | undefined, name?: string): boolean => {
  return name && Array.isArray(option) ? option.includes(name) : !!option
}

export const isJobEnabled = (options: DIOptions, name?: string): boolean =>
  isEnabled(options.jobsEnabled, name)

export const isQueueEnabled = (options: DIOptions, name?: string): boolean =>
  isEnabled(options.queuesEnabled, name)

export type DIOptions = {
  jobsEnabled?: boolean | string[]
  queuesEnabled?: boolean | string[]
}
