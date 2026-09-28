import { readFileSync } from 'node:fs'
import { parseEnv } from 'node:util'

// Unlike process.loadEnvFile, this overrides variables already set in the shell, so an exported
// DATABASE_URL can never point the test cleaners at a non-test database.
Object.assign(process.env, parseEnv(readFileSync('./.env.test', 'utf8')))
