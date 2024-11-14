import { relations } from 'drizzle-orm'
import { integer, pgSchema, uuid, varchar } from 'drizzle-orm/pg-core'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import z from 'zod'

export const userSchema = pgSchema('user')

export const user = userSchema.table('user', {
  id: uuid('id').primaryKey().defaultRandom().notNull(),
  age: integer('age'),
  email: varchar('email').unique().notNull(),
  name: varchar('name').notNull(),
})

const selectUserSchema = createSelectSchema(user)
export type User = z.infer<typeof selectUserSchema>

const insertUserSchema = createInsertSchema(user)
export type NewUser = z.infer<typeof insertUserSchema>

const updateUserSchema = createInsertSchema(user, {
  age: z.number().optional(),
  email: z.string().optional(),
  name: z.string().optional(),
}).omit({ id: true })
export type UpdatedUser = z.infer<typeof updateUserSchema>

export const profile = userSchema.table('profile', {
  id: uuid('id').primaryKey().defaultRandom().notNull(),
  bio: varchar('bio'),
  age: integer('age'),
  email: varchar('email').unique().notNull(),
  userId: uuid('user_id').unique().notNull(),
})

export const profileRelations = relations(profile, ({ one }) => ({
  user: one(user, {
    fields: [profile.userId],
    references: [user.id],
  }),
}))

const selectProfileSchema = createSelectSchema(profile)
export type Profile = z.infer<typeof selectProfileSchema>

const insertProfileSchema = createInsertSchema(profile)
export type NewProfile = z.infer<typeof insertProfileSchema>
