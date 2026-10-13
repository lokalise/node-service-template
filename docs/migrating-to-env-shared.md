# Migrating from `.env.default` to `.env.shared` + `.env.test`

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

## Where a value goes

- **Schema default** in the config file: the variable needs a value in every environment. Use the
  production value.
- **`.env.shared`**: the variable has a sensible value on a developer machine (`localhost`, local
  credentials) but must be set explicitly in deployed environments. No schema default, so a
  missing value in production stops the service from starting.
- **`.env.test`**: tests need a different value than local dev (test database, in-process fakes,
  vendors switched off).
- **`.env`** (gitignored): secrets and personal overrides. Optional.

## Steps

1. **Rename `.env.default` to `.env.shared`** (`git mv`, so history is kept). Add a header saying
   that local dev and tests load it and deployed environments never do. Then clean it up:
   - Remove variables the schema doesn't read.
   - Remove variables whose value equals the schema default.
   - Remove empty `KEY=` placeholders for secrets. List them in a comment instead, as hints for
     what goes in `.env`.
   - Nothing real goes here: tests load this file.

2. **Create `.env.test`** with only what tests need to differ from `.env.shared`:
   - `NODE_ENV=test`.
   - The overrides your test setup does in code (usually `DATABASE_URL` for the test DB,
     endpoints of in-process fakes).
   - Vendors that would call out of the machine switched off (`BUGSNAG_ENABLED=false`,
     `AMPLITUDE_ENABLED=false`, `OTEL_ENABLED=false`, ...), even when `.env.shared` or the schema
     already turns them off. Then enabling a vendor for local dev can't make tests send data.
   - Values tests assert on (for example the version in a healthcheck response).

3. **Load `.env.test` and `.env.shared` in the vitest setup file**, never `.env`:

   ```ts
   process.loadEnvFile('./.env.test')
   process.loadEnvFile('./.env.shared')
   ```

   `loadEnvFile` doesn't override variables that are already set, so `.env.test` wins over
   `.env.shared`, and a variable exported in your shell wins over both. Remove the
   `process.env.X = ...` overrides that are now in `.env.test`. Don't export test-sensitive
   variables (DB URLs, API keys) globally.

4. **Bump envase to `^2.0.0` and enable `emptyStringAsUndefined`**, so empty values count as unset
   and the schema default applies. envase 2.0.0 also fails validation when a blank value would be
   coerced to `0`, so check that no environment relies on that:

   ```ts
   createConfig(process.env, { schema: envSchema, emptyStringAsUndefined: true })
   ```

5. **Load `.env.shared` under `.env` in every local command** (start, db, scripts). With several
   `--env-file` flags, Node lets the last file win:

   ```json
   "start:dev": "node --env-file=.env.shared --env-file-if-exists=.env src/server.ts"
   ```

   - `drizzle-kit` (and other tools using `dotenv`) loads `.env` on its own and doesn't override
     preloaded values. Run it through `node` with the env files preloaded:

     ```json
     "db:apply-migrations": "node --env-file=.env.shared --env-file-if-exists=.env ./node_modules/drizzle-kit/bin.cjs migrate --config=./src/db/drizzle.config.ts",
     "test:migrate": "node --env-file=.env.shared --env-file=.env.test ./node_modules/drizzle-kit/bin.cjs migrate --config=./src/db/drizzle.config.ts"
     ```

   - Tests that spawn child processes with `--env-file=.env` should pass `env: process.env`
     instead, which already holds the test environment.

6. **Remove `copy:config`** from `package.json`, from `test:ci` and from CI workflows, and drop
   `cpy-cli` if nothing else uses it.

7. **Base container/healthcheck test env on `.env.shared` + `.env.test`**, with Docker-specific
   overrides (compose hostnames, `NODE_ENV=production`) layered on top. `docker run` also lets the
   last `--env-file` win, but it can't parse multiline values, so flatten or strip them first.

8. **Update the remaining references** to `.env.default`: README, Dockerfiles and healthcheck
   scripts, `.dockerignore`, CI workflow path filters, agent/Claude instructions. Check with
   `git grep -n 'env.default'`.

9. **Verify** by moving your local `.env` away and running the test suite and the service:
   `mv .env .env.bak && node --run test:ci && node --run start:dev; mv .env.bak .env`
