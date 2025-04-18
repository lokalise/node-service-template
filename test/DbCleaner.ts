import type { PgTable } from 'drizzle-orm/pg-core'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import { post } from '../src/db/schema/post.ts'
import { user } from '../src/db/schema/user.ts'

export const DB_MODEL = {
  User: user,
  Post: post,
} as const satisfies Record<string, PgTable>

export async function cleanTables(drizzle: PostgresJsDatabase, modelNames: PgTable[]) {
  for (const modelName of modelNames) {
    await drizzle.delete(modelName)
  }
}
