import { index, integer, pgSchema, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import z from 'zod'

export const userSchema = pgSchema('user')

export const user = userSchema.table(
  'user',
  {
    id: uuid('id').primaryKey().defaultRandom().notNull(),
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
    id: uuid('id').primaryKey().defaultRandom().notNull(),
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

// zod types stay identical
export const selectUserSchema = createSelectSchema(user)
export type User = z.infer<typeof selectUserSchema>

export const insertUserSchema = createInsertSchema(user)
export type NewUser = z.infer<typeof insertUserSchema>

export const updateUserSchema = createInsertSchema(user, {
  age: z.number().optional(),
  email: z.string().optional(),
  name: z.string().optional(),
}).omit({ id: true })
export type UpdatedUser = z.infer<typeof updateUserSchema>

export const selectProfileSchema = createSelectSchema(profile)
export type Profile = z.infer<typeof selectProfileSchema>

export const insertProfileSchema = createInsertSchema(profile)
export type NewProfile = z.infer<typeof insertProfileSchema>
