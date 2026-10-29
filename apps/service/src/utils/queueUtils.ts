export const buildQueueMessage = <T extends Record<string, unknown>>(object: T): Buffer => {
  return Buffer.from(JSON.stringify(object))
}
