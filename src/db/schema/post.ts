import { boolean, index, pgSchema, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import type z from 'zod'

export const postSchema = pgSchema('post')

export const post = postSchema.table(
  'post',
  {
    id: uuid('id').primaryKey().defaultRandom().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }),
    title: varchar('title', { length: 256 }).notNull(),
    content: varchar('content'),
    published: boolean('published').default(false),
    authorId: varchar('author_id').notNull(),
  },
  (table) => {
    return {
      authorIdIdx: index('author_id_idx').on(table.authorId),
    }
  },
)

const selectPostSchema = createSelectSchema(post)
export type Post = z.infer<typeof selectPostSchema>

const insertPostSchema = createInsertSchema(post)
export type NewPost = z.infer<typeof insertPostSchema>
