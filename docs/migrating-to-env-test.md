# Migrating from `.env.default` to `.env.test` + `.env.example`

How to move a service from the `.env.default` + `copy:config` setup to the one in this template
(see [Environment files](../README.md#environment-files)).

## Why

- Tests read `.env`, which is a copy of `.env.default` in CI but whatever you have locally on your
  machine. Tests can pass locally and fail in CI, or the other way round. With real API keys in
  `.env`, a broken mock sends real requests to third-party APIs.
- `.env.default` isn't a default. A variable missing from `.env` doesn't fall back to it, and
  production never reads it.
- Empty `KEY=` entries override the schema default with an empty string. With `z.url()` or
  `z.enum()` they fail validation, and with `z.coerce.number()` they become `0`.
- Documenting variables in the env file duplicates `docs/environment-variables.md`, which envase
  generates from the schema.

## Steps

1. **Create `.env.test`** with every variable the test suite needs:
   - Start from `.env.default`.
   - Apply the overrides your test setup does in code (usually `DATABASE_URL` for the test DB,
     endpoints of in-process fakes).
   - Set `NODE_ENV=test`.
   - Turn off vendors that would call out of the machine (`BUGSNAG_ENABLED=false`,
     `AMPLITUDE_ENABLED=false`, `OTEL_ENABLED=false`, ...).
   - Only fake credentials go here, since the file is committed.

2. **Load only `.env.test` in the vitest setup file**:

   ```ts
   process.loadEnvFile('./.env.test')
   ```

   Remove the `process.env.X = ...` overrides that are now in `.env.test`. `loadEnvFile` doesn't
   override variables already set in the shell, so an exported `DATABASE_URL` still wins. Don't
   export test-sensitive variables (DB URLs, API keys) globally.

3. **Bump envase to `^2.0.0` and enable `emptyStringAsUndefined`**, so empty values count as unset
   and the schema default applies. envase 2.0.0 also fails validation when a blank value would be
   coerced to `0`, so check that no environment relies on that:

   ```ts
   createConfig(process.env, { schema: envSchema, emptyStringAsUndefined: true })
   ```

4. **Rename `.env.default` to `.env.example`** (`git mv`, so history is kept):
   - Keep empty `KEY=` entries as placeholders for values developers fill in (secrets).
   - Remove variables the schema doesn't read.
   - Point `copy:config` at the new file:

   ```json
   "copy:config": "cpy --rename=.env ./.env.example ./"
   ```

5. **Stop test commands from reading `.env`**:
   - Drop `copy:config` from `test:ci`.
   - `drizzle-kit` (and other tools using `dotenv`) loads `.env` on its own. Run test migrations
     with `.env.test` preloaded, since preloaded values win over `.env`:

     ```json
     "test:migrate": "node --env-file=.env.test ./node_modules/drizzle-kit/bin.cjs migrate --config=./src/db/drizzle.config.ts"
     ```

   - Tests that spawn child processes with `--env-file=.env` should pass `env: process.env`
     instead, which already holds `.env.test`.
   - Keep `copy:config` in CI only for steps that really run against the dev config (for example
     `db:apply-migrations`).

6. **Base container/healthcheck test env on `.env.test`**, not on the example file, with any
   Docker-specific overrides (compose hostnames, `NODE_ENV=production`) layered on top.

7. **Update the remaining references** to `.env.default`: README, Dockerfiles and healthcheck
   scripts, `.dockerignore`, CI workflows, agent/Claude instructions. Check with
   `git grep -n 'env.default'`.

8. **Verify** by moving your local `.env` away and running the test suite:
   `mv .env .env.bak && node --run test:ci; mv .env.bak .env`
