import { pgTable, uuid, text, timestamp, jsonb, unique } from 'drizzle-orm/pg-core'

export const projects = pgTable('projects', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),                        // nombre mostrado (marca)
  normalizedName: text('normalized_name').notNull(),   // clave de agrupación
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => [unique('projects_normalized_name').on(t.normalizedName)])

export const sessions = pgTable('sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name'),
  company: text('company'),
  role: text('role'),
  email: text('email'),
  projectId: uuid('project_id').references(() => projects.id),
  status: text('status').notNull().default('in_progress'), // 'in_progress' | 'completed'
  createdAt: timestamp('created_at').notNull().defaultNow(),
  completedAt: timestamp('completed_at'),
})

export const answers = pgTable('answers', {
  id: uuid('id').defaultRandom().primaryKey(),
  sessionId: uuid('session_id').notNull().references(() => sessions.id),
  questionId: text('question_id').notNull(),
  rawText: text('raw_text').notNull(),
  normalizedText: text('normalized_text'),
  imageChoice: text('image_choice'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => [unique('answers_session_question').on(t.sessionId, t.questionId)])

export const deliverables = pgTable('deliverables', {
  projectId: uuid('project_id').primaryKey().references(() => projects.id),
  content: jsonb('content').notNull(), // Deliverable (ver deliverable/schema.ts)
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})
