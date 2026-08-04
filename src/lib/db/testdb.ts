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
    CREATE TABLE landscape_stages (
      project_id uuid NOT NULL REFERENCES projects(id),
      stage text NOT NULL,
      status text NOT NULL DEFAULT 'pendiente',
      updated_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (project_id, stage)
    );
    CREATE TABLE landscape_versions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      project_id uuid NOT NULL REFERENCES projects(id),
      stage text NOT NULL,
      content jsonb NOT NULL,
      author text NOT NULL,
      author_label text,
      created_at timestamptz NOT NULL DEFAULT now(),
      approved_at timestamptz
    );
    CREATE INDEX landscape_versions_project_stage ON landscape_versions (project_id, stage);
    CREATE TABLE oauth_clients (
      id text PRIMARY KEY,
      secret_hash text,
      name text,
      redirect_uris jsonb NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE oauth_codes (
      code text PRIMARY KEY,
      client_id text NOT NULL,
      redirect_uri text NOT NULL,
      code_challenge text NOT NULL,
      scope text NOT NULL,
      expires_at timestamptz NOT NULL,
      used_at timestamptz
    );
    CREATE TABLE oauth_tokens (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      access_hash text NOT NULL UNIQUE,
      refresh_hash text UNIQUE,
      client_id text NOT NULL,
      scope text NOT NULL,
      access_expires_at timestamptz NOT NULL,
      refresh_expires_at timestamptz,
      revoked_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now()
    );
  `)
  return db
}
export type TestDb = Awaited<ReturnType<typeof makeTestDb>>
