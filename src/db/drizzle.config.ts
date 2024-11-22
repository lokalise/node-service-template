import { defineConfig } from 'drizzle-kit'
// biome-ignore lint/correctness/useImportExtensions: Drizzle can't find .js extension
import { getConfig, isProduction } from '../infrastructure/config'

const config = getConfig()

export default defineConfig({
  schema: isProduction() ? './src/db/schema/*.js' : './src/db/schema/*.ts',
  out: './src/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: config.db.databaseUrl,
  },
})
