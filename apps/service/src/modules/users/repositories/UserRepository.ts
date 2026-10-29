import { eq, inArray } from 'drizzle-orm'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import {
  type NewUser,
  type UpdatedUser,
  type User,
  user as userTable,
} from '../../../db/schema/user.ts'
import type { UsersInjectableDependencies } from '../UserModule.ts'

export class UserRepository {
  private readonly drizzle: PostgresJsDatabase

  constructor({ drizzle }: UsersInjectableDependencies) {
    this.drizzle = drizzle
  }

  async getUser(id: string): Promise<User | null> {
    const [result] = await this.drizzle.select().from(userTable).where(eq(userTable.id, id))

    return result ?? null
  }

  getUsers(userIds: string[]): Promise<User[]> {
    return this.drizzle.select().from(userTable).where(inArray(userTable.id, userIds))
  }

  async deleteUser(id: string): Promise<User | null> {
    const [result] = await this.drizzle.delete(userTable).where(eq(userTable.id, id)).returning()

    return result ?? null
  }

  async updateUser(id: string, updatedUser: UpdatedUser): Promise<User | null> {
    const [result] = await this.drizzle
      .update(userTable)
      .set(updatedUser)
      .where(eq(userTable.id, id))
      .returning()

    return result ?? null
  }

  async createUser(user: NewUser): Promise<User> {
    const [result] = await this.drizzle.insert(userTable).values(user).returning()

    // biome-ignore lint/style/noNonNullAssertion: Insert should fail if no result is returned
    return result!
  }
}
