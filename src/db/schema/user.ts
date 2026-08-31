import { randomUUIDv7 } from 'node:crypto'
import { index, integer, pgSchema, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core'
import { createInsertSchema, createSelectSchema } from 'drizzle-orm/zod'
import { z } from 'zod/v4'

export const userSchema = pgSchema('user')

export const user = userSchema.table(
  'user',
  {
    id: uuid('id').primaryKey().notNull().$defaultFn(randomUUIDv7),
    age: integer('age'),
    email: varchar('email').notNull(),
    name: varchar('name').notNull(),
  },
  (t) => ({
    // indexes/uniques still fine without FKs
    emailUnique: uniqueIndex('user_email_unique').on(t.email),
    nameIdx: index('user_name_idx').on(t.name),
  }),
)

export const profile = userSchema.table(
  'profile',
  {
    id: uuid('id').primaryKey().notNull().$defaultFn(randomUUIDv7),
    bio: varchar('bio'),
    age: integer('age'),
    email: varchar('email').notNull(),
    userId: uuid('user_id').notNull().unique(), // no .references(...) to avoid fk
  },
  (t) => ({
    emailUnique: uniqueIndex('profile_email_unique').on(t.email),
    userIdIdx: index('profile_user_id_idx').on(t.userId), // helpful for joins
  }),
)

// zod types stay identical; z.compile() swaps in the AOT-compiled parser without changing them
export const selectUserSchema = z.compile(createSelectSchema(user))
export type User = z.infer<typeof selectUserSchema>

export const insertUserSchema = z.compile(createInsertSchema(user))
export type NewUser = z.infer<typeof insertUserSchema>

export const updateUserSchema = z.compile(
  createInsertSchema(user, {
    age: z.number().optional(),
    email: z.string().optional(),
    name: z.string().optional(),
  }).omit({ id: true }),
)
export type UpdatedUser = z.infer<typeof updateUserSchema>

export const selectProfileSchema = z.compile(createSelectSchema(profile))
export type Profile = z.infer<typeof selectProfileSchema>

export const insertProfileSchema = z.compile(createInsertSchema(profile))
export type NewProfile = z.infer<typeof insertProfileSchema>
