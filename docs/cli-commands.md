# CLI commands

CLI commands are self-executable scripts that run a piece of application logic with the full DI container available, outside of the HTTP server. They live in [scripts/cmd](../scripts/cmd) and are built on top of [cliCommandWrapper](../scripts/utils/cliCommandWrapper.ts).

## Anatomy of a command

```ts
import type { RequestContext } from '@lokalise/fastify-extras'
import z from 'zod/v4'
import type { Dependencies } from '../../src/infrastructure/CommonModule.ts'
import { cliCommandWrapper } from '../utils/cliCommandWrapper.ts'

const ARGUMENTS_SCHEMA = z.object({
  queue: z.enum(['active', 'failed', 'delayed', 'completed', 'waiting', 'prioritized']),
})
type Arguments = z.infer<typeof ARGUMENTS_SCHEMA>

const command = async (deps: Dependencies, reqContext: RequestContext, args: Arguments) => {
  // application logic; `deps` is the DI cradle, `reqContext.logger` is scoped to this invocation
}

void cliCommandWrapper('getUserImportJobsCommand', command, ARGUMENTS_SCHEMA)
```

The wrapper:

- boots the app with the HTTP-facing and background features disabled (healthchecks, monitoring, periodic jobs, message queue consumers, enqueued job workers) and job queues enabled, so commands can schedule jobs;
- creates a per-invocation `RequestContext` with a child logger tagged with the command name and a fresh `x-request-id`;
- parses and validates CLI arguments against the provided zod schema (see below); on validation failure it logs `Invalid arguments` with the zod issues and exits with code `1`;
- runs the command, logs any thrown error as `Error running command`, closes the app, and exits with code `0` on success or `1` on failure.

Register the command in the `scripts` section of `package.json` and run it with `node --run {npmScriptName} -- {arguments}`.

## Argument schemas: what is supported

`cliCommandWrapper` derives the `node:util` `parseArgs` options from the zod schema itself, so the schema is the single source of truth for both parsing and validation. The schema must be a `z.object(...)` — optionally followed by `.transform(...)` and/or `.pipe(...)` — whose keys are the flag names.

Supported field types on the flag-defining object:

| Schema field                              | CLI behavior                                                       |
| ----------------------------------------- | ------------------------------------------------------------------ |
| `z.string()`, `z.enum([...])`, `z.guid()`, … | string flag: `--key=value`                                        |
| `z.boolean()`                             | boolean flag: `--flag` (present → `true`)                          |
| `z.array(<element>)`                      | repeatable flag: `--id=a --id=b` → `['a', 'b']`                    |
| `.optional()` / `.nullable()` wrappers    | unwrapped transparently, both on fields and on array elements      |

Notes:

- Unknown flags are ignored (`parseArgs` runs with `strict: false`) and stripped by the object schema, so a typo in a flag name surfaces as a "missing required field" validation error rather than an unknown-flag error.
- Anything after a bare `--` token in the final `process.argv` is treated as positionals and ignored — make sure your script runner does not forward the `--` separator itself.
- Coercion beyond booleans is not performed by the parser: every value arrives as a string. Use a transform (below) or `z.coerce.*` on the schema if you need numbers.

### Transforms and pipes

The args schema can end in `.transform(...)` and/or `.pipe(...)`. Flags are always derived from the **input side** of the pipe (the flat `z.object`), while the command handler receives the fully transformed **output** (typed via `z.infer`). This lets a command declare flat flags and reshape them into the nested, schema-validated object its application layer expects, in a single schema:

```ts
const ARGUMENTS_SCHEMA = z
  .object({
    projectId: z.guid(),
    itemId: z.array(z.guid()).optional(), // repeatable flag
  })
  .transform(({ projectId, itemId }, ctx) => {
    const scopeResult = DOMAIN_SCOPE_SCHEMA.safeParse({ itemIds: itemId })
    if (!scopeResult.success) {
      for (const issue of scopeResult.error.issues) ctx.addIssue({ ...issue })
      return z.NEVER
    }
    return { projectId, scope: scopeResult.data }
  })
```

Issues added via `ctx.addIssue` (including ones re-raised from a nested `safeParse` against a shared domain schema) flow through the wrapper's regular `Invalid arguments` handling.

Not supported:

- `z.preprocess(fn, schema)` — its input side is the preprocess function itself, so there is no flag-defining object to derive `parseArgs` options from. Use `z.object(...).transform(...)` instead, which keeps the flat object on the input side.
- Non-object root schemas (unions, records, primitives): no options can be derived, and repeatable/boolean flags will not parse correctly.

## Graceful shutdown

The command handler receives a fourth `lifecycle` argument exposing the app-scoped `AbortSignal`:

```ts
const command = async (deps, reqContext, args, lifecycle) => {
  for (const batch of batches) {
    if (lifecycle.signal.aborted) break
    await processBatch(batch, { signal: lifecycle.signal })
  }
}
```

On SIGTERM/SIGINT (in non-dev environments, where `fastify-graceful-shutdown` is registered) the signal is aborted and the wrapper waits for the command to finish its current step before closing the app. Long-running commands should poll `lifecycle.signal.aborted` between units of work and/or pass the signal to AbortSignal-aware APIs (`node:timers/promises`, `undici`/`fetch`, etc.). See [cliCommandWrapper.integration.spec.ts](../scripts/utils/cliCommandWrapper.integration.spec.ts) for an end-to-end example.
