import z from 'zod/v4'

// Shared auth header.
export const AUTH_HEADERS = z.compile(
  z.object({
    authorization: z.string().describe('Bearer token authorizing the request'),
  }),
)
