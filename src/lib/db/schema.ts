import { pgTable, uuid, text, timestamp, jsonb, unique, primaryKey, index } from 'drizzle-orm/pg-core'

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

// Fase 2 · Landscape. Ver docs/superpowers/specs/2026-07-28-fase2-landscape-columna-vertebral-design.md
//
// Estas dos tablas todavía no existen en Neon (se crean recién con `db:push`), así que
// sus columnas de tiempo van con zona horaria (`timestamptz`) desde el arranque: sin
// zona, el driver arma el `Date` con los componentes crudos usando la zona del proceso
// que lee, no la que escribió — con `TZ=America/Bogota` una fila recién creada se lee
// corrida 5 horas. Las tablas de fase 1 (`projects`, `sessions`, etc.) ya existen en Neon
// con datos y se dejan como están: cambiarlas ahí sí sería una migración, no un alta.
/** Una fila por etapa del landscape de un proyecto. El estado, y nada más. */
export const landscapeStages = pgTable('landscape_stages', {
  projectId: uuid('project_id').notNull().references(() => projects.id),
  stage: text('stage').notNull(),                          // StageKey
  status: text('status').notNull().default('pendiente'),   // StageStatus
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.projectId, t.stage] })])

/**
 * Append-only: nada se pisa. La versión aprobada es la que cuenta; las anteriores
 * quedan para volver atrás y para ver cómo evolucionó la etapa.
 */
export const landscapeVersions = pgTable('landscape_versions', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id').notNull().references(() => projects.id),
  stage: text('stage').notNull(),                          // StageKey
  content: jsonb('content').notNull(),                     // la salida de la etapa
  author: text('author').notNull(),                        // 'claude' | 'humano'
  authorLabel: text('author_label'),                       // quién, si se sabe
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
}, (t) => [index('landscape_versions_project_stage').on(t.projectId, t.stage)])
