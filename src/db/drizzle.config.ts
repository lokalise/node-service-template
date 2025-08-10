import { defineConfig } from 'drizzle-kit'
import { getConfig, isProduction } from '../infrastructure/config.ts'

const config = getConfig()

// biome-ignore lint/style/noDefaultExport: drizzle expects default export
export default defineConfig({
  schema: isProduction() ? './src/db/schema/*.ts' : './src/db/schema/*.ts',
  out: './src/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: config.db.databaseUrl,
  },
})
