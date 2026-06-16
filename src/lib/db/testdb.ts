import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import * as schema from './schema'

export async function makeTestDb() {
  const client = new PGlite()
  const db = drizzle(client, { schema })
  await client.exec(`
    CREATE TABLE sessions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name text, company text, role text, email text,
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
    CREATE TABLE briefs (
      session_id uuid PRIMARY KEY REFERENCES sessions(id),
      content jsonb NOT NULL,
      created_at timestamp NOT NULL DEFAULT now()
    );
  `)
  return db
}
export type TestDb = Awaited<ReturnType<typeof makeTestDb>>
