import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import * as schema from './schema'

export async function makeTestDb() {
  const client = new PGlite()
  const db = drizzle(client, { schema })
  await client.exec(`
    CREATE TABLE projects (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name text NOT NULL,
      normalized_name text NOT NULL UNIQUE,
      created_at timestamp NOT NULL DEFAULT now()
    );
    CREATE TABLE sessions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name text, company text, role text, email text,
      project_id uuid REFERENCES projects(id),
      status text NOT NULL DEFAULT 'in_progress',
      created_at timestamp NOT NULL DEFAULT now(),
      completed_at timestamp
    );
    CREATE TABLE answers (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      session_id uuid NOT NULL REFERENCES sessions(id),
      question_id text NOT NULL,
      raw_text text NOT NULL,
      normalized_text text,
      image_choice text,
      created_at timestamp NOT NULL DEFAULT now(),
      UNIQUE (session_id, question_id)
    );
    CREATE TABLE deliverables (
      project_id uuid PRIMARY KEY REFERENCES projects(id),
      content jsonb NOT NULL,
      updated_at timestamp NOT NULL DEFAULT now()
    );
  `)
  return db
}
export type TestDb = Awaited<ReturnType<typeof makeTestDb>>
