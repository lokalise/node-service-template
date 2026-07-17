# CLI commands

CLI commands are self-executable scripts that run a piece of application logic with the full DI container available, outside of the HTTP server — one-off maintenance tasks, backfills, queue inspection, debugging helpers. They live in [scripts/cmd](../scripts/cmd) and are built on top of [cliCommandWrapper](../scripts/utils/cliCommandWrapper.ts).

## Quick start

A command is a file with three parts: an arguments schema, a handler, and the wrapper call. As a worked example, a command that re-sends welcome emails to a list of users, with an optional dry-run mode:

```ts
// scripts/cmd/resendWelcomeEmail.ts
import type { RequestContext } from '@lokalise/fastify-extras'
import z from 'zod/v4'
import type { Dependencies } from '../../src/infrastructure/CommonModule.ts'
import { cliCommandWrapper } from '../utils/cliCommandWrapper.ts'

const ARGUMENTS_SCHEMA = z.object({
  userId: z.array(z.guid()).min(1), // repeatable flag
  dryRun: z.boolean().optional(),
})
type Arguments = z.infer<typeof ARGUMENTS_SCHEMA>

const command = async (deps: Dependencies, reqContext: RequestContext, args: Arguments) => {
  for (const userId of args.userId) {
    if (args.dryRun) {
      reqContext.logger.info({ userId }, 'dry run - would resend welcome email')
      continue
    }
    await deps.userService.resendWelcomeEmail(userId)
  }
}

void cliCommandWrapper('resendWelcomeEmailCommand', command, ARGUMENTS_SCHEMA)
```

Register it in the `scripts` section of `package.json`, following the `cmd:` prefix convention:

```json
"scripts": {
  "cmd:resendWelcomeEmail": "node --env-file-if-exists=.env scripts/cmd/resendWelcomeEmail.ts"
}
```

Run it with `node --run {npmScriptName} -- {arguments}`:

```shell
node --run cmd:resendWelcomeEmail -- --userId=0198a3d2-... --userId=0198a3d5-... --dryRun
```

The flags above parse into:

```ts
{ userId: ['0198a3d2-...', '0198a3d5-...'], dryRun: true }
```

If validation fails — say, a `--userId` is not a valid GUID or the flag is missing entirely — the wrapper logs an `Invalid arguments` entry containing the zod issues and exits with code `1` without running the handler:

```shell
node --run cmd:resendWelcomeEmail -- --dryRun
# logs: Invalid arguments … "path":["userId"],"message":"Invalid input: expected array, received undefined"
# exit code: 1
```

See [getUserImportJobs.ts](../scripts/cmd/getUserImportJobs.ts) for a real command in this repository.

## What the wrapper does

- Boots the app with the HTTP-facing and background features disabled (healthchecks, monitoring, periodic jobs, message queue consumers, enqueued job workers) and job queues enabled, so commands can schedule jobs. If the app fails to boot, it logs `Failed to start {commandName}` and exits with code `1`.
- Creates a per-invocation `RequestContext` with a child logger tagged with the command name and a fresh `x-request-id`, so every log line of a run is correlated.
- Parses and validates CLI arguments against the provided zod schema (see below).
- Runs the command handler with `(dependencies, requestContext, args, lifecycle)` — `dependencies` is the DI cradle, exactly what route handlers and consumers receive.
- Logs any thrown error as `Error running command`, closes the app, and exits with the appropriate code.

Exit codes:

| Code | Meaning                                                       |
| ---- | ------------------------------------------------------------- |
| `0`  | Command completed without throwing                            |
| `1`  | App failed to boot, arguments were invalid, or handler threw  |

The arguments schema is optional — commands that take no arguments can call `cliCommandWrapper(name, command)` and receive `args: undefined`.

## Argument schemas: what is supported

`cliCommandWrapper` derives the `node:util` `parseArgs` options from the zod schema itself, so the schema is the single source of truth for both parsing and validation. The schema must be a `z.object(...)` — optionally followed by `.transform(...)` and/or `.pipe(...)` — whose keys are the flag names.

Supported field types on the flag-defining object:

| Schema field                                 | CLI behavior                                                  | Example                          |
| -------------------------------------------- | ------------------------------------------------------------- | -------------------------------- |
| `z.string()`, `z.enum([...])`, `z.guid()`, … | string flag                                                    | `--queue=active`                 |
| `z.boolean()`                                | boolean flag (present → `true`)                                | `--dryRun`                       |
| `z.array(<element>)`                         | repeatable flag                                                | `--id=a --id=b` → `['a', 'b']`   |
| `.optional()` / `.nullable()` wrappers       | unwrapped transparently, both on fields and on array elements  | omitting the flag → `undefined`  |

Notes:

- Unknown flags are ignored (`parseArgs` runs with `strict: false`) and stripped by the object schema, so a typo in a flag name surfaces as a "missing required field" validation error rather than an unknown-flag error.
- Anything after a bare `--` token in the final `process.argv` is treated as positionals and ignored — make sure your script runner does not forward the `--` separator itself.
- Coercion beyond booleans is not performed by the parser: every value arrives as a string. Use `z.coerce.number()` (or a transform, below) if you need numbers:

  ```ts
  z.object({ batchSize: z.coerce.number().int().positive().default(100) })
  // --batchSize=250 → { batchSize: 250 }
  ```

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

// --projectId=<guid> --itemId=<guid> --itemId=<guid>
//   → { projectId: '<guid>', scope: { itemIds: ['<guid>', '<guid>'] } }
```

Issues added via `ctx.addIssue` (including ones re-raised from a nested `safeParse` against a shared domain schema, as above) flow through the wrapper's regular `Invalid arguments` handling.

A plain `.pipe(...)` also works when no reshaping is needed, e.g. to bolt a stricter output schema onto loosely-typed flags:

```ts
z.object({ count: z.string() })
  .transform(({ count }) => ({ count: Number(count) }))
  .pipe(z.object({ count: z.number().int() }))
```

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
