import { pgTable, uuid, text, timestamp, jsonb } from 'drizzle-orm/pg-core'

export const sessions = pgTable('sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name'),
  company: text('company'),
  role: text('role'),
  email: text('email'),
  status: text('status').notNull().default('in_progress'), // 'in_progress' | 'completed'
  createdAt: timestamp('created_at').notNull().defaultNow(),
  completedAt: timestamp('completed_at'),
})

export const answers = pgTable('answers', {
  id: uuid('id').defaultRandom().primaryKey(),
  sessionId: uuid('session_id').notNull().references(() => sessions.id),
  questionId: text('question_id').notNull(),
  rawText: text('raw_text').notNull(),
  imageChoice: text('image_choice'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const briefs = pgTable('briefs', {
  sessionId: uuid('session_id').primaryKey().references(() => sessions.id),
  content: jsonb('content').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})
