export type DIOptions = {
  bullmqProcessorsEnabled?: boolean | string[]
  bullmqQueuesEnabled?: boolean | string[]
  amqpConsumersEnabled?: boolean | string[]
}

export const resolveBullmqQueuesEnabled = (options: DIOptions): boolean | string[] => {
  const { bullmqQueuesEnabled } = options
  if (!bullmqQueuesEnabled) return false
  if (Array.isArray(bullmqQueuesEnabled)) {
    return bullmqQueuesEnabled.length ? bullmqQueuesEnabled : false
  }

  return bullmqQueuesEnabled
}

export const isBullmqProcessorEnabled = (options: DIOptions, name?: string): boolean =>
  isEnabled(options.bullmqProcessorsEnabled, name)

export const isAmqpConsumerEnabled = (options: DIOptions, name?: string): boolean =>
  isEnabled(options.amqpConsumersEnabled, name)

const isEnabled = (option: boolean | string[] | undefined, name?: string): boolean => {
  return name && Array.isArray(option) ? option.includes(name) : !!option
}
