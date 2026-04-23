# @node-service-template/api-contracts

API contracts for `node-service-template`. Contains the Zod schemas and
[`@lokalise/api-contracts`](https://www.npmjs.com/package/@lokalise/api-contracts)
REST contracts that describe the service's public HTTP API.

Publish this package independently so that client applications can consume the
contracts without pulling in the service itself.

## Usage

```ts
import {
  postCreateUserContract,
  USER_SCHEMA,
} from '@node-service-template/api-contracts'
```

## Scripts

- `pnpm run build` — type-check and emit `dist/` (used when publishing)
- `pnpm run clean` — remove the `dist/` directory
