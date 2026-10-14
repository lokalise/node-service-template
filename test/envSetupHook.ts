import { existsSync } from 'node:fs'

// loadEnvFile doesn't override variables that are already set, so the file loaded first wins
if (existsSync('./.env.test.local')) {
  process.loadEnvFile('./.env.test.local')
}
process.loadEnvFile('./.env.test')
