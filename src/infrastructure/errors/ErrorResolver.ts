import type { InternalError } from '@lokalise/node-core'

/**
 * Generic interface for resolving specific kind of errors based on something that was thrown during execution
 */
export type ErrorResolver = {
  processError: (thrownError: unknown) => InternalError
}
