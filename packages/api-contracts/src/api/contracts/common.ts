import z from 'zod/v4'

// Shared auth header.
export const AUTH_HEADERS = z.compile(
  z.object({
    authorization: z.string().describe('Bearer token authorizing the request'),
  }),
)

// Shape of any 5xx body produced by the shared error handler (createErrorHandler):
// a generic `INTERNAL_SERVER_ERROR`, a `RESPONSE_VALIDATION_ERROR`, etc. Public
// contracts that expose internal fields must declare this so the api-visibility
// serializer has an encoder for server errors; without it a 500 to a public caller
// has no encoder and fails serialization. Kept permissive (generic `code`, optional
// `details`) so it matches every 5xx variant the handler can emit.
export const INTERNAL_SERVER_ERROR_RESPONSE_SCHEMA = z.compile(
  z.object({
    message: z.string().describe('Human-readable error message'),
    code: z.string().describe('Machine-readable error code'),
    errorCode: z.string().describe('Machine-readable error code (legacy alias of `code`)'),
    details: z.unknown().optional().describe('Optional structured error details'),
  }),
)
