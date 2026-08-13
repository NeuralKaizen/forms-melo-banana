import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import * as schema from './schema'

const DDL = `
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
  CREATE TABLE strategy_stages (
    project_id uuid NOT NULL REFERENCES projects(id),
    stage text NOT NULL,
    status text NOT NULL DEFAULT 'pendiente',
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (project_id, stage)
  );
  CREATE TABLE strategy_versions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id uuid NOT NULL REFERENCES projects(id),
    stage text NOT NULL,
    content jsonb NOT NULL,
    author text NOT NULL,
    author_label text,
    created_at timestamptz NOT NULL DEFAULT now(),
    approved_at timestamptz
  );
  CREATE INDEX strategy_versions_project_stage ON strategy_versions (project_id, stage);
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
`

async function levantarInstancia() {
  const client = new PGlite()
  const db = drizzle(client, { schema })
  await client.exec(DDL)
  return { client, db }
}

// Una sola instancia PGlite por archivo de test, no una por test. Levantar Postgres-en-WASM
// entero y correr el DDL de las trece tablas en cada `beforeEach` era lo que hacía pelear por
// CPU y memoria a los forks que vitest corre en paralelo: el costo se paga una vez y entre
// tests sólo se vacían las tablas. Vitest aísla el registro de módulos por archivo, así que
// este singleton nunca se comparte entre archivos.
let compartida: (Awaited<ReturnType<typeof levantarInstancia>> & { truncate: string }) | null = null

/**
 * Devuelve una base vacía, equivalente a una instancia recién creada: sin filas en ninguna
 * tabla y con las secuencias reiniciadas. Reutiliza la instancia del archivo.
 */
export async function makeTestDb() {
  if (compartida) {
    await compartida.client.exec(compartida.truncate)
    return compartida.db
  }

  const { client, db } = await levantarInstancia()
  // La lista de tablas sale del catálogo y no de una constante escrita a mano: si mañana el
  // DDL suma una tabla, la limpieza la cubre sola y no queda nada de un test filtrándose al
  // siguiente. `CASCADE` destraba las claves foráneas y `RESTART IDENTITY` deja las secuencias
  // como en una base nueva.
  const catalogo = await client.query<{ nombre: string }>(
    `SELECT tablename AS nombre FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`,
  )
  const lista = catalogo.rows.map(t => `"public"."${t.nombre}"`).join(', ')
  compartida = { client, db, truncate: `TRUNCATE TABLE ${lista} RESTART IDENTITY CASCADE;` }
  return db
}

/**
 * Instancia propia y aislada, sin compartir con nadie. Es para el único caso que necesita dos
 * bases vivas al mismo tiempo dentro de un test; para todo lo demás va `makeTestDb`.
 */
export async function makeFreshTestDb() {
  const { db } = await levantarInstancia()
  return db
}

export type TestDb = Awaited<ReturnType<typeof makeTestDb>>
