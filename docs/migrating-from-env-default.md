# Migrating from `.env.default` to `.env.development` + `.env.test`

How to move a service from the `.env.default` + `copy:config` setup to the one in this template
(see [Environment files](../README.md#environment-files)).

## Why

- Tests read `.env`, which is a copy of `.env.default` in CI but whatever you have locally on your
  machine. Tests can pass locally and fail in CI, or the other way round. With real API keys in
  `.env`, a broken mock sends real requests to third-party APIs.
- `test:ci` runs `copy:config`, so running it locally overwrites your `.env`.
- `.env.default` isn't a default. `copy:config` copies it once, and after that a variable missing
  from `.env` doesn't fall back to it. Pulling a change that adds a required variable breaks your
  local setup until you copy the value over by hand. Production never reads the file either.
- Test config lives in two places: `.env` and the overrides patched in the vitest setup file.
- Empty `KEY=` entries override the schema default with an empty string. With `z.url()` or
  `z.enum()` they fail validation, and with `z.coerce.number()` they become `0`.

## The layout

The names follow the [Vite convention](https://vite.dev/guide/env-and-mode#env-files): one
committed file per mode, and a gitignored `.local` file on top of it.

- **Schema default** in the config file: the variable needs a value in every environment. Use the
  production value. This takes the place of Vite's generic `.env`.
- **`.env.development`**: values for local development that differ from the schema default, and
  required variables with a sensible local value (`localhost`, local credentials).
- **`.env.test`**: every variable the test suite needs. It shares many entries with
  `.env.development`. That's deliberate: each file is complete for its mode.
- **`.env.development.local`** and **`.env.test.local`** (gitignored): secrets and personal
  overrides. Optional.

There is no `.env` or `.env.local`. Vite loads those in every mode, so personal values would reach
test runs again.

## Steps

1. **Rename `.env.default` to `.env.development`** (`git mv`, so history is kept). Add a header
   saying what loads it and that tests and deployed environments never do. Then clean it up:
   - Remove variables the schema doesn't read.
   - Remove variables whose value equals the schema default.
   - Comment out empty `KEY=` placeholders for secrets (`# BUGSNAG_KEY=`) where they are, as hints
     for what goes in `.env.development.local`.
   - Nothing real goes here: the file is committed.

2. **Create `.env.test`** with every variable the test suite needs:
   - Start from `.env.development`.
   - Set `NODE_ENV=test`.
   - Apply the overrides your test setup does in code (usually `DATABASE_URL` for the test DB,
     endpoints of in-process fakes).
   - Switch off vendors whose schema default is on and that would call out of the machine
     (`BUGSNAG_ENABLED=false`, `OTEL_ENABLED=false`, ...).

3. **Ignore `.local` files**: add `*.local` to `.gitignore`.

4. **Load `.env.test.local` and `.env.test` in the vitest setup file**:

   ```ts
   import { existsSync } from 'node:fs'

   if (existsSync('./.env.test.local')) {
     process.loadEnvFile('./.env.test.local')
   }
   process.loadEnvFile('./.env.test')
   ```

   `loadEnvFile` doesn't override variables that are already set, so the file loaded first wins,
   and a variable exported in your shell wins over both. Remove the `process.env.X = ...`
   overrides that are now in `.env.test`. Don't export test-sensitive variables (DB URLs, API keys)
   globally.

5. **Bump envase to `^2.0.0` and enable `emptyStringAsUndefined`**, so empty values count as unset
   and the schema default applies. envase 2.0.0 also fails validation when a blank value would be
   coerced to `0`, so check that no environment relies on that:

   ```ts
   createConfig(process.env, { schema: envSchema, emptyStringAsUndefined: true })
   ```

6. **Point every local command at the mode's files** (start, db, scripts). With several
   `--env-file` flags, Node lets the last file win:

   ```json
   "start:dev": "node --env-file=.env.development --env-file-if-exists=.env.development.local src/server.ts"
   ```

   - `drizzle-kit` (and other tools using `dotenv`) loads `.env` on its own and doesn't override
     preloaded values. Run it through `node` with the env files preloaded:

     ```json
     "db:apply-migrations": "node --env-file=.env.development --env-file-if-exists=.env.development.local ./node_modules/drizzle-kit/bin.cjs migrate --config=./src/db/drizzle.config.ts",
     "test:migrate": "node --env-file=.env.test --env-file-if-exists=.env.test.local ./node_modules/drizzle-kit/bin.cjs migrate --config=./src/db/drizzle.config.ts"
     ```

   - Tests that spawn child processes with `--env-file=.env` should pass `env: process.env`
     instead, which already holds the test environment.

7. **Remove `copy:config`** from `package.json`, from `test:ci` and from CI workflows, and drop
   `cpy-cli` if nothing else uses it.

8. **Base container/healthcheck test env on `.env.test`**, without `.env.test.local`, with
   Docker-specific overrides (compose hostnames, `NODE_ENV=production`) layered on top. `docker
   run` also lets the last `--env-file` win, but it can't parse multiline values, so flatten or
   strip them first.

9. **Update the remaining references** to `.env.default` and `.env`: README, Dockerfiles and
   healthcheck scripts, `.dockerignore`, CI workflow path filters, agent/Claude instructions. Check
   with `git grep -nE "env\.default|env-file(-if-exists)?=\.env\b"`.

10. **Tell the team**: move personal values from `.env` to `.env.development.local`, then delete
    `.env`. Until it's gone, `drizzle-kit` still loads it, though only for variables the env files
    don't set.

11. **Verify** by moving your local `.env` away and running the test suite:
    `mv .env .env.bak && node --run test:ci; mv .env.bak .env`. Then start the service with
    `node --run start:dev`.
