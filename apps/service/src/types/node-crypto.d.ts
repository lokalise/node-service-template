// Node 24.16+ ships `crypto.randomUUIDv7`, but @types/node has not published the
// declaration yet. Drop this file once it lands upstream.
declare module 'node:crypto' {
  function randomUUIDv7(): string
}
