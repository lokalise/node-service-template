import { sql } from 'drizzle-orm'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'

export enum DB_MODEL {
  User = 'user',
  Post = 'post',
}

export async function cleanTables(drizzle: PostgresJsDatabase, modelNames: readonly DB_MODEL[]) {
  for (const model of modelNames) {
    const tableName = model.valueOf()
    const schemaName = getSchemaForModel(model)
    await drizzle.execute(sql.raw(`delete from "${schemaName}".${tableName}`))
  }
}

function getSchemaForModel(model: DB_MODEL): string {
  switch (model) {
    case DB_MODEL.User:
      return 'user'
    case DB_MODEL.Post:
      return 'post'
    default:
      throw new Error(`No schema defined for model: ${model}`)
  }
}
