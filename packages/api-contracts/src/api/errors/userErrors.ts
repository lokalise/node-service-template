import { definePublicError, ErrorType } from '@lokalise/errors'
import z from 'zod/v4'

// Public error definitions live next to the contracts so clients can parse error responses
// with the same schemas the server uses to produce them (see `mergeErrorSchemasByStatusCode`
// in userApiContracts.ts). The service binds each definition to an error class inside the
// owning module, e.g. src/modules/users/errors/UserNotFoundError.ts.
export const USER_NOT_FOUND_ERROR_DEFINITION = definePublicError({
  code: 'USER_NOT_FOUND',
  type: ErrorType.NOT_FOUND,
  detailsSchema: z.object({ id: z.string() }),
})
