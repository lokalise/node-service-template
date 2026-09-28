# Migrating from `.env.default` to `.env.test` + `.env.example`

How to move a service from the `.env.default` + `copy:config` setup to the one in this template
(see [Environment files](../README.md#environment-files)).

## Why

- Tests read `.env`, which is a copy of `.env.default` in CI but whatever you have locally on your
  machine. Tests can pass locally and fail in CI, or the other way round. With real API keys in
  `.env`, a broken mock sends real requests to third-party APIs.
- `.env.default` isn't a default. A variable missing from `.env` doesn't fall back to it, and
  production never reads it.
- Empty `KEY=` entries are ambiguous (is it meant to be an empty string, or a placeholder?) and
  override the schema default. With `z.url()` or `z.enum()` they fail validation.
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
   - Remove every empty `KEY=` entry.
   - Only fake credentials go here, since the file is committed.

2. **Load only `.env.test` in the vitest setup file**:

   ```ts
   import { readFileSync } from 'node:fs'
   import { parseEnv } from 'node:util'

   // Unlike process.loadEnvFile, this overrides variables already set in the shell, so an exported
   // DATABASE_URL can never point the test cleaners at a non-test database.
   Object.assign(process.env, parseEnv(readFileSync('./.env.test', 'utf8')))
   ```

   Remove the `process.env.X = ...` overrides that are now in `.env.test`.

3. **Rename `.env.default` to `.env.example`** (`git mv`, so history is kept):
   - Remove empty `KEY=` entries. Comment out optional ones you want to keep for discoverability
     (`# BUGSNAG_KEY=`).
   - Remove variables the schema doesn't read.
   - Point `copy:config` at the new file:

   ```json
   "copy:config": "cpy --rename=.env ./.env.example ./"
   ```

4. **Stop test commands from reading `.env`**:
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

5. **Update the remaining references** to `.env.default`: README, Dockerfiles and healthcheck
   scripts, `.dockerignore`, CI workflows, agent/Claude instructions. Check with
   `git grep -n 'env.default'`.

6. **Verify** by moving your local `.env` away and running the test suite:
   `mv .env .env.bak && node --run test:ci; mv .env.bak .env`
