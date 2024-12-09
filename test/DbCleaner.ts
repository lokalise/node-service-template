import type { PgTable } from 'drizzle-orm/pg-core'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import { post } from '../src/db/schema/post.js'
import { user } from '../src/db/schema/user.js'

export const DB_MODEL: Record<string, PgTable> = {
  User: user,
  Post: post,
}

export async function cleanTables(drizzle: PostgresJsDatabase, modelNames: PgTable[]) {
  for (const modelName of modelNames) {
    await drizzle.delete(modelName)
  }
}
