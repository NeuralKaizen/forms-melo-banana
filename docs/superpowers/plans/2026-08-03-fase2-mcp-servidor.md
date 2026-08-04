# Fase 2 · Servidor MCP — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que M&B conecte claude.ai a la plataforma y lo que trabajan en el chat quede guardado en el proyecto, sin que nosotros corramos un solo modelo.

**Architecture:** Una ruta MCP (`/api/mcp`) sobre `mcp-handler`, protegida por OAuth donde la app misma es el servidor de autorización. Las cuatro herramientas envuelven funciones del store que ya existen. Toda la lógica vive en `src/lib/oauth/` y `src/lib/mcp/` como funciones que reciben `db`, testeables con PGlite; las rutas son cáscaras finas.

**Tech Stack:** Next.js 16 (App Router), `mcp-handler` v2 sobre el SDK de MCP v2, zod v4, Drizzle sobre Neon (`neon-http`), PGlite para tests, Vitest.

## Contexto para quien implementa

Lee antes de empezar: `docs/superpowers/specs/2026-08-03-fase2-mcp-servidor-design.md` (el diseño aprobado) y `docs/superpowers/specs/2026-07-28-fase2-landscape-columna-vertebral-design.md` (la columna vertebral sobre la que esto se apoya).

Lo que ya existe y **no** hay que rehacer:

- `src/lib/db/store.ts` — `listProjectsWithCounts`, `getProjectWithSessions`, `getDeliverable`, `landscapeState`, `saveLandscapeVersion`, `listLandscapeVersions`, `normalizeCompanyName`, `listProjects`, y las clases `ErrorNoEncontrado` / `ErrorDeValidacion`. Todo con tests.
- `src/lib/landscape/stages.ts` — `StageKey`, `STAGE_ORDER`, `STAGE_LABEL`, `EJES`, `TendenciaCandidata`, `MIN_TENDENCIAS`, `MAX_TENDENCIAS`.
- `src/lib/db/testdb.ts` — levanta Postgres en memoria con el esquema a mano. **Cada tabla nueva se agrega también ahí o los tests no la ven.**
- `src/lib/admin/auth.ts` — `isValidAdminToken(token)`. La cookie `admin` guarda la contraseña.

## Global Constraints

- **La plataforma no corre modelos.** Ninguna tarea llama a la API de Anthropic ni gasta tokens.
- **`landscape_versions` es append-only.** Nada se actualiza salvo `approved_at`.
- **Claude nunca aprueba.** Toda escritura entra como borrador. No se expone ninguna herramienta que apruebe.
- **Los secretos se guardan hasheados**, nunca en claro: códigos, access tokens, refresh tokens y el secreto de cliente.
- **Comillas tipográficas.** El copy que ve una persona usa `“ ”` (U+201C/U+201D) y `—` (U+2014), no `"` ni `-`. Verificar por bytes: `rg -n $'—' <archivo>`.
- **Alias de imports:** `@/` resuelve en Next y en Vitest.
- **Idioma:** las funciones del store existente siguen en inglés; el código nuevo de `oauth/` y `mcp/` va en español, como el resto del dominio. Copy en español.
- **Node 24** (ya está en `engines`). `mcp-handler` v2 pide Node 20+.
- **Variable nueva:** `MCP_PUBLIC_URL` = `https://forms-melo-banana.vercel.app` (sin barra final). Va a `.env`, `.env.example` y a Vercel en Production y Preview.
- **Commits:** convención del repo, en español, con scope — `feat(mcp): …`, `test(oauth): …`. Todo mensaje termina con:
  ```
  Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01QZfk1nidbEd53KE6Uwwxy4
  ```
- **Tests:** `npx vitest run <archivo>` para uno, `npm test` para todo. Nunca se comitea con la suite en rojo.

## Estructura de archivos

| Archivo | Responsabilidad |
|---|---|
| `drizzle/` (crear) | Migraciones versionadas. Se generan, no se escriben a mano (salvo la edición de idempotencia de la Tarea 1). |
| `package.json` (modificar) | El build aplica migraciones antes de compilar. |
| `next.config.ts` (modificar) | Rewrites de `/.well-known/*`. |
| `src/lib/db/schema.ts` (modificar) | Las tres tablas de OAuth. |
| `src/lib/db/testdb.ts` (modificar) | El mismo DDL a mano para PGlite. |
| `src/lib/oauth/crypto.ts` (crear) | Generación de tokens, hasheo, verificación PKCE. Funciones puras. |
| `src/lib/oauth/store.ts` (crear) | Clientes, códigos y tokens sobre `db`. Sin HTTP. |
| `src/lib/oauth/metadata.ts` (crear) | Los dos documentos de descubrimiento, derivados de `MCP_PUBLIC_URL`. |
| `src/app/well-known/oauth-protected-resource/route.ts` (crear) | Sirve el documento de recurso protegido. |
| `src/app/well-known/oauth-authorization-server/route.ts` (crear) | Sirve la metadata del servidor de autorización. |
| `src/app/api/oauth/register/route.ts` (crear) | Registro dinámico de cliente (JSON). |
| `src/app/api/oauth/authorize/route.ts` (crear) | Consentimiento reusando el login, y emisión del código. |
| `src/app/api/oauth/token/route.ts` (crear) | Canje de código y refresh (form-urlencoded). |
| `src/lib/mcp/errores.ts` (crear) | `ErrorDeHerramienta`. |
| `src/lib/mcp/resolver.ts` (crear) | Resuelve un proyecto por nombre o id. |
| `src/lib/mcp/validar.ts` (crear) | Valida el contenido de la etapa Tendencias. |
| `src/lib/mcp/tools.ts` (crear) | Las cuatro herramientas como funciones sobre `db`. |
| `src/app/api/mcp/route.ts` (crear) | Registra las herramientas y aplica `withMcpAuth`. |
| `docs/fase2/instrucciones-claude-ai.md` (crear) | El bloque que M&B pega en su proyecto de claude.ai. |

---

### Task 1: Migraciones versionadas

Va primera porque todo lo demás agrega tablas, y el 2026-07-31 el deploy salió antes que las tablas y el admin entero respondió 500 durante diez minutos.

**Files:**
- Create: `drizzle/` (generado)
- Modify: `package.json`

**Interfaces:**
- Consumes: `drizzle.config.ts` (ya existe, apunta a `./src/lib/db/schema.ts` y `out: './drizzle'`).
- Produces: `npm run db:migrate`, y un `build` que lo corre antes de `next build`.

- [ ] **Step 1: Generar la primera migración desde el esquema actual**

Run: `npx drizzle-kit generate`

Esto crea `drizzle/0000_<nombre>.sql` con las **siete tablas que ya existen** en Neon, más `drizzle/meta/`. No lo apliques todavía.

- [ ] **Step 2: Hacer idempotente la migración 0000**

Producción ya tiene esas siete tablas con datos reales (5 proyectos, 16 sesiones, 221 respuestas, 3 entregables). Aplicar el archivo tal cual falla con “ya existe”.

Edita `drizzle/0000_<nombre>.sql`:

- Cada `CREATE TABLE "x" (` pasa a `CREATE TABLE IF NOT EXISTS "x" (`
- Cada `CREATE INDEX "x"` pasa a `CREATE INDEX IF NOT EXISTS "x"`
- Cada `ALTER TABLE ... ADD CONSTRAINT ...;` se envuelve así, porque `ADD CONSTRAINT` no admite `IF NOT EXISTS`:

```sql
DO $$ BEGIN
 ALTER TABLE "sessions" ADD CONSTRAINT "sessions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
```

**No toques `drizzle/meta/`.** No borres ni recrees ninguna tabla existente para “emparejar”: se irían los datos.

- [ ] **Step 3: Agregar el script de migración y engancharlo al build**

En `package.json`, dentro de `scripts`:

```json
"db:migrate": "drizzle-kit migrate",
"build": "drizzle-kit migrate && next build",
```

- [ ] **Step 4: Verificar contra una base vacía**

Con `DATABASE_URL` apuntando a la rama de desarrollo de Neon (vacía):

Run: `npm run db:migrate`
Expected: aplica 0000 sin error, y `npm run db:projects` responde `proyectos (0):` en vez de fallar con `relation "projects" does not exist`.

- [ ] **Step 5: Verificar que es idempotente**

Run: `npm run db:migrate`
Expected: no hace nada y no falla — la migración ya está registrada en `drizzle.__drizzle_migrations`.

- [ ] **Step 6: Commit**

```bash
git add drizzle package.json
git commit -m "feat(db): migraciones versionadas aplicadas en el build"
```

---

### Task 2: Las tres tablas de OAuth

**Files:**
- Modify: `src/lib/db/schema.ts`
- Modify: `src/lib/db/testdb.ts`
- Test: `src/lib/db/store.test.ts`

**Interfaces:**
- Produces: `oauthClients`, `oauthCodes`, `oauthTokens` (tablas Drizzle).

- [ ] **Step 1: Escribe el test que falla**

Al final de `src/lib/db/store.test.ts`:

```ts
describe('oauth · esquema', () => {
  it('guarda un cliente y lo lee de vuelta', async () => {
    const db = await makeTestDb()
    const [c] = await db.insert(oauthClients).values({
      id: 'cli_1',
      redirectUris: ['https://claude.ai/api/mcp/auth_callback'],
    }).returning()
    expect(c.secretHash).toBeNull()
    expect(c.redirectUris).toEqual(['https://claude.ai/api/mcp/auth_callback'])
  })

  it('el access hash es único', async () => {
    const db = await makeTestDb()
    const fila = {
      accessHash: 'h1', clientId: 'cli_1', scope: 'landscape',
      accessExpiresAt: new Date(Date.now() + 3600_000),
    }
    await db.insert(oauthTokens).values(fila)
    await expect(db.insert(oauthTokens).values(fila)).rejects.toThrow()
  })
})
```

Agrega las tablas al import de schema que ya está arriba del archivo:

```ts
import { answers, landscapeStages, landscapeVersions, oauthClients, oauthCodes, oauthTokens } from './schema'
```

- [ ] **Step 2: Corre el test para verificar que falla**

Run: `npx vitest run src/lib/db/store.test.ts -t "oauth · esquema"`
Expected: FAIL — no existe el export `oauthClients` en `./schema`.

- [ ] **Step 3: Agrega las tablas al esquema**

Al final de `src/lib/db/schema.ts`:

```ts
// Fase 2 · OAuth. La app es su propio servidor de autorización para el conector de
// claude.ai. Ver docs/superpowers/specs/2026-08-03-fase2-mcp-servidor-design.md
//
// Nada se guarda en claro: `secret_hash`, `code`, `access_hash` y `refresh_hash` son
// sha256 del valor real. Si la base se filtra, no hay credencial utilizable adentro.
export const oauthClients = pgTable('oauth_clients', {
  id: text('id').primaryKey(),
  secretHash: text('secret_hash'),                    // null = cliente público (el caso de DCR)
  name: text('name'),
  redirectUris: jsonb('redirect_uris').notNull().$type<string[]>(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const oauthCodes = pgTable('oauth_codes', {
  code: text('code').primaryKey(),                    // hasheado
  clientId: text('client_id').notNull(),
  redirectUri: text('redirect_uri').notNull(),
  codeChallenge: text('code_challenge').notNull(),    // PKCE S256
  scope: text('scope').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  usedAt: timestamp('used_at', { withTimezone: true }),
})

export const oauthTokens = pgTable('oauth_tokens', {
  id: uuid('id').defaultRandom().primaryKey(),
  accessHash: text('access_hash').notNull().unique(),
  refreshHash: text('refresh_hash').unique(),
  clientId: text('client_id').notNull(),
  scope: text('scope').notNull(),
  accessExpiresAt: timestamp('access_expires_at', { withTimezone: true }).notNull(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})
```

- [ ] **Step 4: Agrega el mismo DDL a PGlite**

En `src/lib/db/testdb.ts`, dentro del template de `client.exec`, después de `landscape_versions`:

```sql
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
      revoked_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now()
    );
```

- [ ] **Step 5: Corre el test**

Run: `npx vitest run src/lib/db/store.test.ts -t "oauth · esquema"`
Expected: PASS

- [ ] **Step 6: Generar la migración de las tablas nuevas**

Run: `npx drizzle-kit generate`
Expected: aparece `drizzle/0001_<nombre>.sql` con solo las tres tablas nuevas. **Este archivo no se edita** — crea tablas que no existen en ningún lado.

Run: `npm run db:migrate`
Expected: aplica 0001 contra la rama de desarrollo.

- [ ] **Step 7: Commit**

```bash
git add src/lib/db/schema.ts src/lib/db/testdb.ts src/lib/db/store.test.ts drizzle
git commit -m "feat(oauth): las tres tablas del servidor de autorización"
```

---

### Task 3: Criptografía de OAuth

**Files:**
- Create: `src/lib/oauth/crypto.ts`
- Test: `src/lib/oauth/crypto.test.ts`

**Interfaces:**
- Produces:
  - `nuevoToken(): string` — 32 bytes al azar en base64url
  - `hashear(valor: string): string` — sha256 en hex
  - `verificarPkceS256(verifier: string, challenge: string): boolean`

- [ ] **Step 1: Escribe el test que falla**

Crea `src/lib/oauth/crypto.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { createHash } from 'node:crypto'
import { nuevoToken, hashear, verificarPkceS256 } from './crypto'

describe('oauth · crypto', () => {
  it('cada token es distinto y no trae relleno de base64', () => {
    const a = nuevoToken()
    const b = nuevoToken()
    expect(a).not.toBe(b)
    expect(a).not.toContain('=')
    expect(a.length).toBeGreaterThan(32)
  })

  it('hashear es estable y no devuelve el valor original', () => {
    expect(hashear('hola')).toBe(hashear('hola'))
    expect(hashear('hola')).not.toBe('hola')
    expect(hashear('hola')).not.toBe(hashear('chau'))
  })

  it('acepta el verifier que produjo el challenge', () => {
    const verifier = nuevoToken()
    const challenge = createHash('sha256').update(verifier).digest('base64url')
    expect(verificarPkceS256(verifier, challenge)).toBe(true)
  })

  it('rechaza un verifier que no corresponde', () => {
    const challenge = createHash('sha256').update(nuevoToken()).digest('base64url')
    expect(verificarPkceS256(nuevoToken(), challenge)).toBe(false)
  })

  it('rechaza un challenge vacío en vez de aceptarlo por descuido', () => {
    expect(verificarPkceS256(nuevoToken(), '')).toBe(false)
  })
})
```

- [ ] **Step 2: Corre el test para verificar que falla**

Run: `npx vitest run src/lib/oauth/crypto.test.ts`
Expected: FAIL — no existe `./crypto`.

- [ ] **Step 3: Implementa**

Crea `src/lib/oauth/crypto.ts`:

```ts
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'

/** Token opaco para códigos, access y refresh. base64url: viaja en URLs y headers sin escapar. */
export function nuevoToken(): string {
  return randomBytes(32).toString('base64url')
}

/**
 * Lo que se guarda en la base. Un token robado de la base no sirve para nada porque
 * lo que hay guardado es el hash, no el token.
 */
export function hashear(valor: string): string {
  return createHash('sha256').update(valor).digest('hex')
}

/**
 * PKCE S256: el challenge es sha256(verifier) en base64url. La comparación va en tiempo
 * constante — comparar con === filtra por cuánto tarda en encontrar la primera diferencia.
 */
export function verificarPkceS256(verifier: string, challenge: string): boolean {
  if (!verifier || !challenge) return false
  const esperado = Buffer.from(createHash('sha256').update(verifier).digest('base64url'))
  const recibido = Buffer.from(challenge)
  if (esperado.length !== recibido.length) return false
  return timingSafeEqual(esperado, recibido)
}
```

- [ ] **Step 4: Corre el test**

Run: `npx vitest run src/lib/oauth/crypto.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/oauth/crypto.ts src/lib/oauth/crypto.test.ts
git commit -m "feat(oauth): tokens, hasheo y verificación de PKCE"
```

---

### Task 4: El store de OAuth

El corazón de la seguridad. Cada regla acá tiene su test.

**Files:**
- Create: `src/lib/oauth/store.ts`
- Test: `src/lib/oauth/store.test.ts`

**Interfaces:**
- Consumes: `nuevoToken`, `hashear`, `verificarPkceS256` de la Tarea 3; `oauthClients`, `oauthCodes`, `oauthTokens` de la Tarea 2.
- Produces:
  - `class ErrorOAuth extends Error { codigo: string }` — `codigo` es el de RFC 6749 (`invalid_grant`, `invalid_client`, …)
  - `registrarCliente(db, d: { redirectUris: string[]; name?: string }): Promise<{ id: string; redirectUris: string[] }>`
  - `crearCodigo(db, d: { clientId: string; redirectUri: string; codeChallenge: string; scope: string; ahora?: Date }): Promise<string>`
  - `canjearCodigo(db, codigo: string, d: { clientId: string; redirectUri: string; codeVerifier: string; ahora?: Date }): Promise<{ scope: string }>`
  - `emitirTokens(db, d: { clientId: string; scope: string; ahora?: Date }): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }>`
  - `rotarRefresh(db, refreshToken: string, d: { clientId: string; ahora?: Date }): Promise<{ accessToken: string; refreshToken: string; expiresIn: number; scope: string }>`
  - `verificarAccessToken(db, token: string, ahora?: Date): Promise<{ clientId: string; scope: string } | null>`

`ahora` se inyecta para poder testear vencimientos sin esperar una hora.

- [ ] **Step 1: Escribe el test que falla**

Crea `src/lib/oauth/store.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { makeTestDb } from '@/lib/db/testdb'
import { createHash } from 'node:crypto'
import { nuevoToken } from './crypto'
import {
  ErrorOAuth, registrarCliente, crearCodigo, canjearCodigo,
  emitirTokens, rotarRefresh, verificarAccessToken,
} from './store'

const CALLBACK = 'https://claude.ai/api/mcp/auth_callback'

async function clienteConCodigo(db: Awaited<ReturnType<typeof makeTestDb>>) {
  const cliente = await registrarCliente(db, { redirectUris: [CALLBACK] })
  const verifier = nuevoToken()
  const challenge = createHash('sha256').update(verifier).digest('base64url')
  const codigo = await crearCodigo(db, {
    clientId: cliente.id, redirectUri: CALLBACK, codeChallenge: challenge, scope: 'landscape',
  })
  return { cliente, verifier, codigo }
}

describe('oauth · store', () => {
  it('canjea un código válido una vez', async () => {
    const db = await makeTestDb()
    const { cliente, verifier, codigo } = await clienteConCodigo(db)
    const { scope } = await canjearCodigo(db, codigo, {
      clientId: cliente.id, redirectUri: CALLBACK, codeVerifier: verifier,
    })
    expect(scope).toBe('landscape')
  })

  it('un código usado no se puede volver a usar', async () => {
    const db = await makeTestDb()
    const { cliente, verifier, codigo } = await clienteConCodigo(db)
    const d = { clientId: cliente.id, redirectUri: CALLBACK, codeVerifier: verifier }
    await canjearCodigo(db, codigo, d)
    await expect(canjearCodigo(db, codigo, d)).rejects.toThrow(ErrorOAuth)
  })

  it('rechaza un code_verifier que no corresponde', async () => {
    const db = await makeTestDb()
    const { cliente, codigo } = await clienteConCodigo(db)
    await expect(canjearCodigo(db, codigo, {
      clientId: cliente.id, redirectUri: CALLBACK, codeVerifier: nuevoToken(),
    })).rejects.toThrow(ErrorOAuth)
  })

  it('rechaza un redirect_uri distinto del que pidió el código', async () => {
    const db = await makeTestDb()
    const { cliente, verifier, codigo } = await clienteConCodigo(db)
    await expect(canjearCodigo(db, codigo, {
      clientId: cliente.id, redirectUri: 'https://otro.example/cb', codeVerifier: verifier,
    })).rejects.toThrow(ErrorOAuth)
  })

  it('rechaza un código vencido', async () => {
    const db = await makeTestDb()
    const { cliente, verifier, codigo } = await clienteConCodigo(db)
    const enUnRato = new Date(Date.now() + 20 * 60_000)
    await expect(canjearCodigo(db, codigo, {
      clientId: cliente.id, redirectUri: CALLBACK, codeVerifier: verifier, ahora: enUnRato,
    })).rejects.toThrow(ErrorOAuth)
  })

  it('un access token recién emitido verifica', async () => {
    const db = await makeTestDb()
    const cliente = await registrarCliente(db, { redirectUris: [CALLBACK] })
    const { accessToken } = await emitirTokens(db, { clientId: cliente.id, scope: 'landscape' })
    expect(await verificarAccessToken(db, accessToken)).toEqual({
      clientId: cliente.id, scope: 'landscape',
    })
  })

  it('un access token vencido no verifica', async () => {
    const db = await makeTestDb()
    const cliente = await registrarCliente(db, { redirectUris: [CALLBACK] })
    const { accessToken } = await emitirTokens(db, { clientId: cliente.id, scope: 'landscape' })
    const enDosHoras = new Date(Date.now() + 2 * 3600_000)
    expect(await verificarAccessToken(db, accessToken, enDosHoras)).toBeNull()
  })

  it('un token inventado no verifica', async () => {
    const db = await makeTestDb()
    expect(await verificarAccessToken(db, nuevoToken())).toBeNull()
  })

  it('el refresh rota: el viejo muere y el nuevo sirve', async () => {
    const db = await makeTestDb()
    const cliente = await registrarCliente(db, { redirectUris: [CALLBACK] })
    const primero = await emitirTokens(db, { clientId: cliente.id, scope: 'landscape' })
    const segundo = await rotarRefresh(db, primero.refreshToken, { clientId: cliente.id })

    expect(segundo.refreshToken).not.toBe(primero.refreshToken)
    expect(await verificarAccessToken(db, segundo.accessToken)).not.toBeNull()
    await expect(rotarRefresh(db, primero.refreshToken, { clientId: cliente.id }))
      .rejects.toThrow(ErrorOAuth)
  })

  it('el access token viejo deja de servir después de rotar', async () => {
    const db = await makeTestDb()
    const cliente = await registrarCliente(db, { redirectUris: [CALLBACK] })
    const primero = await emitirTokens(db, { clientId: cliente.id, scope: 'landscape' })
    await rotarRefresh(db, primero.refreshToken, { clientId: cliente.id })
    expect(await verificarAccessToken(db, primero.accessToken)).toBeNull()
  })

  it('un cliente no puede usar el refresh de otro', async () => {
    const db = await makeTestDb()
    const a = await registrarCliente(db, { redirectUris: [CALLBACK] })
    const b = await registrarCliente(db, { redirectUris: [CALLBACK] })
    const tokens = await emitirTokens(db, { clientId: a.id, scope: 'landscape' })
    await expect(rotarRefresh(db, tokens.refreshToken, { clientId: b.id }))
      .rejects.toThrow(ErrorOAuth)
  })

  it('rechaza registrar un redirect_uri que no es https', async () => {
    const db = await makeTestDb()
    await expect(registrarCliente(db, { redirectUris: ['http://evil.example/cb'] }))
      .rejects.toThrow(ErrorOAuth)
  })
})
```

- [ ] **Step 2: Corre el test para verificar que falla**

Run: `npx vitest run src/lib/oauth/store.test.ts`
Expected: FAIL — no existe `./store`.

- [ ] **Step 3: Implementa**

Crea `src/lib/oauth/store.ts`:

```ts
import { and, eq, isNull } from 'drizzle-orm'
import type { AnyDb } from '@/lib/db/store'
import { oauthClients, oauthCodes, oauthTokens } from '@/lib/db/schema'
import { hashear, nuevoToken, verificarPkceS256 } from './crypto'

/** El `codigo` es el de RFC 6749: la ruta lo devuelve tal cual en el JSON de error. */
export class ErrorOAuth extends Error {
  constructor(public codigo: string, mensaje: string) {
    super(mensaje)
    this.name = 'ErrorOAuth'
  }
}

const VIDA_CODIGO_MS = 10 * 60_000
const VIDA_ACCESS_S = 3600

export async function registrarCliente(
  db: AnyDb, d: { redirectUris: string[]; name?: string },
): Promise<{ id: string; redirectUris: string[] }> {
  if (!d.redirectUris?.length)
    throw new ErrorOAuth('invalid_redirect_uri', 'Hace falta al menos un redirect_uri')
  // Solo https: un redirect_uri en texto plano deja el código de autorización expuesto
  // en tránsito, y el código es lo único que separa a un atacante de un token.
  for (const uri of d.redirectUris)
    if (!uri.startsWith('https://'))
      throw new ErrorOAuth('invalid_redirect_uri', `El redirect_uri tiene que ser https: ${uri}`)

  const id = `cli_${nuevoToken()}`
  await db.insert(oauthClients).values({ id, redirectUris: d.redirectUris, name: d.name ?? null })
  return { id, redirectUris: d.redirectUris }
}

export async function crearCodigo(db: AnyDb, d: {
  clientId: string; redirectUri: string; codeChallenge: string; scope: string; ahora?: Date
}): Promise<string> {
  const ahora = d.ahora ?? new Date()
  const codigo = nuevoToken()
  await db.insert(oauthCodes).values({
    code: hashear(codigo),
    clientId: d.clientId,
    redirectUri: d.redirectUri,
    codeChallenge: d.codeChallenge,
    scope: d.scope,
    expiresAt: new Date(ahora.getTime() + VIDA_CODIGO_MS),
  })
  return codigo
}

export async function canjearCodigo(db: AnyDb, codigo: string, d: {
  clientId: string; redirectUri: string; codeVerifier: string; ahora?: Date
}): Promise<{ scope: string }> {
  const ahora = d.ahora ?? new Date()
  const [fila] = await db.select().from(oauthCodes).where(eq(oauthCodes.code, hashear(codigo)))

  // Un solo mensaje para todos los rechazos del código: distinguir "no existe" de
  // "es de otro cliente" le diría a quien prueba a ciegas cuándo acertó la mitad.
  const malo = () => new ErrorOAuth('invalid_grant', 'El código no es válido, ya se usó o venció')

  if (!fila) throw malo()
  if (fila.usedAt) throw malo()
  if (fila.expiresAt <= ahora) throw malo()
  if (fila.clientId !== d.clientId) throw malo()
  if (fila.redirectUri !== d.redirectUri) throw malo()
  if (!verificarPkceS256(d.codeVerifier, fila.codeChallenge)) throw malo()

  // Marcar usado con `usedAt is null` en el WHERE: si dos pedidos llegan juntos, solo
  // uno actualiza una fila y el otro se va con las manos vacías.
  const sellado = await db.update(oauthCodes)
    .set({ usedAt: ahora })
    .where(and(eq(oauthCodes.code, fila.code), isNull(oauthCodes.usedAt)))
    .returning()
  if (!sellado.length) throw malo()

  return { scope: fila.scope }
}

export async function emitirTokens(db: AnyDb, d: {
  clientId: string; scope: string; ahora?: Date
}): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
  const ahora = d.ahora ?? new Date()
  const accessToken = nuevoToken()
  const refreshToken = nuevoToken()
  await db.insert(oauthTokens).values({
    accessHash: hashear(accessToken),
    refreshHash: hashear(refreshToken),
    clientId: d.clientId,
    scope: d.scope,
    accessExpiresAt: new Date(ahora.getTime() + VIDA_ACCESS_S * 1000),
  })
  return { accessToken, refreshToken, expiresIn: VIDA_ACCESS_S }
}

export async function rotarRefresh(db: AnyDb, refreshToken: string, d: {
  clientId: string; ahora?: Date
}): Promise<{ accessToken: string; refreshToken: string; expiresIn: number; scope: string }> {
  const ahora = d.ahora ?? new Date()
  const [fila] = await db.select().from(oauthTokens)
    .where(eq(oauthTokens.refreshHash, hashear(refreshToken)))

  const malo = () => new ErrorOAuth('invalid_grant', 'El refresh token no es válido o ya se usó')
  if (!fila || fila.revokedAt || fila.clientId !== d.clientId) throw malo()

  // Revocar con `revoked_at is null` en el WHERE, por lo mismo que el código: dos
  // refresh simultáneos con el mismo token no pueden emitir dos pares de tokens.
  const revocado = await db.update(oauthTokens)
    .set({ revokedAt: ahora })
    .where(and(eq(oauthTokens.id, fila.id), isNull(oauthTokens.revokedAt)))
    .returning()
  if (!revocado.length) throw malo()

  const nuevos = await emitirTokens(db, { clientId: fila.clientId, scope: fila.scope, ahora })
  return { ...nuevos, scope: fila.scope }
}

export async function verificarAccessToken(
  db: AnyDb, token: string, ahora: Date = new Date(),
): Promise<{ clientId: string; scope: string } | null> {
  const [fila] = await db.select().from(oauthTokens)
    .where(eq(oauthTokens.accessHash, hashear(token)))
  if (!fila || fila.revokedAt || fila.accessExpiresAt <= ahora) return null
  return { clientId: fila.clientId, scope: fila.scope }
}
```

`AnyDb` hoy está declarado sin exportar en `src/lib/db/store.ts:6`. Cambiá esa línea:

```ts
export type AnyDb = any // drizzle db (neon-http or pglite); kept loose for the adapter seam
```

- [ ] **Step 4: Corre el test**

Run: `npx vitest run src/lib/oauth/store.test.ts`
Expected: PASS (12 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/oauth/store.ts src/lib/oauth/store.test.ts src/lib/db/store.ts
git commit -m "feat(oauth): clientes, códigos de un solo uso y rotación de refresh"
```

---

### Task 5: Los documentos de descubrimiento

**Files:**
- Create: `src/lib/oauth/metadata.ts`
- Create: `src/lib/oauth/metadata.test.ts`
- Create: `src/app/well-known/oauth-protected-resource/route.ts`
- Create: `src/app/well-known/oauth-authorization-server/route.ts`
- Modify: `next.config.ts`
- Modify: `.env.example`

**Interfaces:**
- Produces:
  - `baseUrl(): string` — `MCP_PUBLIC_URL` sin barra final
  - `urlDelMcp(): string` — `${baseUrl()}/api/mcp`
  - `docRecursoProtegido(): object`
  - `docServidorAutorizacion(): object`

Los `.well-known` viven en `src/app/well-known/` con un rewrite, y no en una carpeta que arranca con punto: así no dependemos de cómo trata Next a los directorios ocultos.

- [ ] **Step 1: Escribe el test que falla**

Crea `src/lib/oauth/metadata.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { baseUrl, urlDelMcp, docRecursoProtegido, docServidorAutorizacion } from './metadata'

beforeEach(() => { process.env.MCP_PUBLIC_URL = 'https://ejemplo.test/' })

describe('oauth · metadata', () => {
  it('saca la barra final para que el resource compare exacto', () => {
    expect(baseUrl()).toBe('https://ejemplo.test')
    expect(urlDelMcp()).toBe('https://ejemplo.test/api/mcp')
  })

  it('el resource apunta al endpoint MCP, no a la raíz', () => {
    expect(docRecursoProtegido()).toMatchObject({
      resource: 'https://ejemplo.test/api/mcp',
      authorization_servers: ['https://ejemplo.test'],
    })
  })

  it('el servidor de autorización anuncia PKCE S256 y los tres endpoints', () => {
    const doc = docServidorAutorizacion() as Record<string, unknown>
    expect(doc.code_challenge_methods_supported).toEqual(['S256'])
    expect(doc.authorization_endpoint).toBe('https://ejemplo.test/api/oauth/authorize')
    expect(doc.token_endpoint).toBe('https://ejemplo.test/api/oauth/token')
    expect(doc.registration_endpoint).toBe('https://ejemplo.test/api/oauth/register')
    expect(doc.grant_types_supported).toEqual(['authorization_code', 'refresh_token'])
  })

  it('explota si falta la variable, en vez de anunciar una URL vacía', () => {
    delete process.env.MCP_PUBLIC_URL
    expect(() => baseUrl()).toThrow(/MCP_PUBLIC_URL/)
  })
})
```

- [ ] **Step 2: Corre el test para verificar que falla**

Run: `npx vitest run src/lib/oauth/metadata.test.ts`
Expected: FAIL — no existe `./metadata`.

- [ ] **Step 3: Implementa**

Crea `src/lib/oauth/metadata.ts`:

```ts
/**
 * Todo sale de una sola variable para que mudar de dominio sea configuración y no
 * cirugía. El `resource` tiene que coincidir *exacto* con la URL que se pega en
 * claude.ai, path incluido: si difiere en una barra, el descubrimiento falla.
 */
export function baseUrl(): string {
  const v = process.env.MCP_PUBLIC_URL
  if (!v) throw new Error('Falta MCP_PUBLIC_URL')
  return v.replace(/\/+$/, '')
}

export function urlDelMcp(): string {
  return `${baseUrl()}/api/mcp`
}

export function docRecursoProtegido() {
  return {
    resource: urlDelMcp(),
    authorization_servers: [baseUrl()],
    scopes_supported: ['landscape'],
    bearer_methods_supported: ['header'],
  }
}

export function docServidorAutorizacion() {
  const base = baseUrl()
  return {
    issuer: base,
    authorization_endpoint: `${base}/api/oauth/authorize`,
    token_endpoint: `${base}/api/oauth/token`,
    registration_endpoint: `${base}/api/oauth/register`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none'],
    scopes_supported: ['landscape'],
  }
}
```

- [ ] **Step 4: Corre el test**

Run: `npx vitest run src/lib/oauth/metadata.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Sirve los dos documentos**

Crea `src/app/well-known/oauth-protected-resource/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { docRecursoProtegido } from '@/lib/oauth/metadata'

// Sin CORS el descubrimiento desde un cliente de navegador falla, y el documento es
// público por definición: no dice nada que no esté ya en la URL del conector.
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' }

export async function GET() {
  return NextResponse.json(docRecursoProtegido(), { headers: CORS })
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS })
}
```

Crea `src/app/well-known/oauth-authorization-server/route.ts` igual, pero con `docServidorAutorizacion`.

- [ ] **Step 6: Agrega los rewrites**

En `next.config.ts`:

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      { source: '/.well-known/oauth-protected-resource', destination: '/well-known/oauth-protected-resource' },
      { source: '/.well-known/oauth-authorization-server', destination: '/well-known/oauth-authorization-server' },
      // Algunos clientes prueban el documento del recurso colgando el path del MCP.
      { source: '/.well-known/oauth-protected-resource/api/mcp', destination: '/well-known/oauth-protected-resource' },
    ]
  },
};

export default nextConfig;
```

- [ ] **Step 7: Verifica a mano**

Agrega `MCP_PUBLIC_URL=http://localhost:3000` a `.env` y la línea correspondiente a `.env.example`.

Run: `npm run dev`, y en otra terminal:

```bash
curl -s http://localhost:3000/.well-known/oauth-protected-resource | head -20
curl -s http://localhost:3000/.well-known/oauth-authorization-server | head -20
```

Expected: los dos JSON, con `resource` terminando en `/api/mcp`.

- [ ] **Step 8: Commit**

```bash
git add src/lib/oauth/metadata.ts src/lib/oauth/metadata.test.ts src/app/well-known next.config.ts .env.example
git commit -m "feat(oauth): documentos de descubrimiento y sus rutas"
```

---

### Task 6: Las tres rutas de OAuth

**Files:**
- Create: `src/app/api/oauth/register/route.ts`
- Create: `src/app/api/oauth/authorize/route.ts`
- Create: `src/app/api/oauth/token/route.ts`

**Interfaces:**
- Consumes: todo lo de las Tareas 3-5, y `isValidAdminToken` de `@/lib/admin/auth`.

No hay tests automáticos acá: el repo no tiene andamiaje para tests HTTP y toda la lógica ya está cubierta en la Tarea 4. La verificación es el flujo completo del Paso 5.

- [ ] **Step 1: Registro dinámico de cliente**

Crea `src/app/api/oauth/register/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import { ErrorOAuth, registrarCliente } from '@/lib/oauth/store'

// RFC 7591: el cuerpo del registro va en JSON. Ojo que el de /token va form-urlencoded.
export async function POST(req: Request) {
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_client_metadata' }, { status: 400 })
  }

  const uris = body.redirect_uris
  if (!Array.isArray(uris) || uris.some(u => typeof u !== 'string'))
    return NextResponse.json({ error: 'invalid_redirect_uri' }, { status: 400 })

  try {
    const cliente = await registrarCliente(db, {
      redirectUris: uris as string[],
      name: typeof body.client_name === 'string' ? body.client_name : undefined,
    })
    return NextResponse.json({
      client_id: cliente.id,
      redirect_uris: cliente.redirectUris,
      token_endpoint_auth_method: 'none',
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
    }, { status: 201 })
  } catch (e) {
    if (e instanceof ErrorOAuth)
      return NextResponse.json({ error: e.codigo, error_description: e.message }, { status: 400 })
    throw e
  }
}
```

- [ ] **Step 2: Consentimiento y emisión del código**

Crea `src/app/api/oauth/authorize/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { oauthClients } from '@/lib/db/schema'
import { isValidAdminToken } from '@/lib/admin/auth'
import { crearCodigo } from '@/lib/oauth/store'

interface Pedido {
  clientId: string; redirectUri: string; state: string
  codeChallenge: string; scope: string
}

/**
 * Lee y valida el pedido. El redirect_uri se compara contra los registrados *antes*
 * de redirigir a ningún lado: sin eso, cualquiera podría llevarse el código a un
 * dominio propio pasando su URL por query string.
 */
async function leerPedido(url: URL): Promise<Pedido | { error: string }> {
  const clientId = url.searchParams.get('client_id') ?? ''
  const redirectUri = url.searchParams.get('redirect_uri') ?? ''
  const codeChallenge = url.searchParams.get('code_challenge') ?? ''
  const metodo = url.searchParams.get('code_challenge_method') ?? ''

  if (!clientId || !redirectUri) return { error: 'Faltan client_id o redirect_uri' }
  if (metodo !== 'S256') return { error: 'Solo se admite code_challenge_method=S256' }
  if (!codeChallenge) return { error: 'Falta code_challenge' }

  const [cliente] = await db.select().from(oauthClients).where(eq(oauthClients.id, clientId))
  if (!cliente) return { error: 'Cliente desconocido' }
  if (!(cliente.redirectUris as string[]).includes(redirectUri))
    return { error: 'El redirect_uri no está registrado para este cliente' }

  return {
    clientId, redirectUri, codeChallenge,
    state: url.searchParams.get('state') ?? '',
    scope: url.searchParams.get('scope') || 'landscape',
  }
}

function pantalla(url: URL): Response {
  // La app no tiene identidad de usuario: quien pasó el login del panel es quien
  // consiente. Por eso alcanza con un botón.
  const html = `<!doctype html><html lang="es"><meta charset="utf-8">
<title>Conectar con Claude</title>
<style>
  body { font-family: ui-sans-serif, system-ui, sans-serif; max-width: 32rem;
         margin: 6rem auto; padding: 0 1.5rem; line-height: 1.6; color: #1a1a1a }
  h1 { font-size: 1.35rem; margin-bottom: .5rem }
  p { color: #555 }
  ul { color: #555 }
  button { font: inherit; padding: .7rem 1.4rem; border: 0; border-radius: .5rem;
           background: #1a1a1a; color: #fff; cursor: pointer; margin-top: 1.5rem }
</style>
<h1>Conectar Claude con la plataforma</h1>
<p>Claude va a poder:</p>
<ul>
  <li>leer los proyectos, las entrevistas y el estado del landscape;</li>
  <li>escribir <strong>borradores</strong> de etapas.</li>
</ul>
<p>No va a poder aprobar nada — aprobar sigue siendo un acto humano, desde el panel.</p>
<form method="post"><button type="submit">Conectar</button></form>`
  return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8' } })
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const pedido = await leerPedido(url)
  if ('error' in pedido) return NextResponse.json({ error: pedido.error }, { status: 400 })

  const cookie = (await cookies()).get('admin')?.value
  if (!isValidAdminToken(cookie)) {
    // Sin sesión: al login de siempre, y de vuelta acá con los mismos parámetros.
    const destino = new URL('/admin/login', url.origin)
    destino.searchParams.set('next', url.pathname + url.search)
    return NextResponse.redirect(destino)
  }
  return pantalla(url)
}

export async function POST(req: Request) {
  const url = new URL(req.url)
  const pedido = await leerPedido(url)
  if ('error' in pedido) return NextResponse.json({ error: pedido.error }, { status: 400 })

  const cookie = (await cookies()).get('admin')?.value
  if (!isValidAdminToken(cookie)) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const codigo = await crearCodigo(db, {
    clientId: pedido.clientId,
    redirectUri: pedido.redirectUri,
    codeChallenge: pedido.codeChallenge,
    scope: pedido.scope,
  })

  const destino = new URL(pedido.redirectUri)
  destino.searchParams.set('code', codigo)
  if (pedido.state) destino.searchParams.set('state', pedido.state)
  return NextResponse.redirect(destino, { status: 303 })
}
```

Hoy `src/app/admin/login/page.tsx` manda siempre a `/admin` (`location.href = '/admin'`), así que la vuelta al `authorize` se perdería. En esa misma tarea, agregá el soporte de `next`.

Al principio del componente `Login`:

```tsx
import { useSearchParams } from 'next/navigation'
```

Dentro del componente, antes de `submit`:

```tsx
const params = useSearchParams()
// Solo rutas internas: un `next` que empiece con `//` o con un esquema convertiría
// el login en un redirector abierto hacia otro dominio.
const crudo = params.get('next') ?? ''
const destino = crudo.startsWith('/') && !crudo.startsWith('//') ? crudo : '/admin'
```

Y en `submit`, reemplazá `location.href = '/admin'` por `location.href = destino`.

`useSearchParams` obliga a que el árbol tenga un `<Suspense>` arriba en build de producción. Si `npm run build` se queja de eso, envolvé el contenido del `export default` en `<Suspense fallback={null}>…</Suspense>` importando `Suspense` de `react`.

- [ ] **Step 3: Canje y refresh**

Crea `src/app/api/oauth/token/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import { ErrorOAuth, canjearCodigo, emitirTokens, rotarRefresh } from '@/lib/oauth/store'

// RFC 6749: form-urlencoded, no JSON. Con el parser de JSON esto devuelve 415 y el
// flujo muere sin explicación del lado del cliente.
export async function POST(req: Request) {
  const form = new URLSearchParams(await req.text())
  const grant = form.get('grant_type')
  const clientId = form.get('client_id') ?? ''

  try {
    if (grant === 'authorization_code') {
      const { scope } = await canjearCodigo(db, form.get('code') ?? '', {
        clientId,
        redirectUri: form.get('redirect_uri') ?? '',
        codeVerifier: form.get('code_verifier') ?? '',
      })
      const t = await emitirTokens(db, { clientId, scope })
      return NextResponse.json({
        access_token: t.accessToken,
        refresh_token: t.refreshToken,
        token_type: 'Bearer',
        expires_in: t.expiresIn,
        scope,
      }, { headers: { 'cache-control': 'no-store' } })
    }

    if (grant === 'refresh_token') {
      const t = await rotarRefresh(db, form.get('refresh_token') ?? '', { clientId })
      return NextResponse.json({
        access_token: t.accessToken,
        refresh_token: t.refreshToken,
        token_type: 'Bearer',
        expires_in: t.expiresIn,
        scope: t.scope,
      }, { headers: { 'cache-control': 'no-store' } })
    }

    return NextResponse.json({ error: 'unsupported_grant_type' }, { status: 400 })
  } catch (e) {
    // El código RFC importa: Claude reintenta el flujo completo ante `invalid_grant`,
    // y se queda trabado ante cualquier otra cosa.
    if (e instanceof ErrorOAuth)
      return NextResponse.json({ error: e.codigo, error_description: e.message }, { status: 400 })
    throw e
  }
}
```

- [ ] **Step 4: Corre la suite entera**

Run: `npm test`
Expected: PASS, sin regresiones.

- [ ] **Step 5: Verifica el flujo completo a mano**

Con `npm run dev` corriendo:

```bash
# 1. Registro
curl -s -X POST http://localhost:3000/api/oauth/register \
  -H 'content-type: application/json' \
  -d '{"redirect_uris":["https://claude.ai/api/mcp/auth_callback"],"client_name":"prueba"}'
```

Expected: 201 con un `client_id`.

Después, en el navegador, abrí `/api/oauth/authorize` con ese `client_id`, un `code_challenge` S256 y `redirect_uri=https://claude.ai/api/mcp/auth_callback`. Expected: si no hay sesión, caés en el login; después, la pantalla de consentimiento; al aceptar, redirige a claude.ai con `?code=…` (que va a dar 404 en claude.ai, es lo esperado — lo que importa es el código en la URL).

Con ese código y el `code_verifier`:

```bash
curl -s -X POST http://localhost:3000/api/oauth/token \
  -d grant_type=authorization_code -d code=<CODIGO> \
  -d redirect_uri=https://claude.ai/api/mcp/auth_callback \
  -d client_id=<CLIENT_ID> -d code_verifier=<VERIFIER>
```

Expected: `access_token`, `refresh_token`, `expires_in: 3600`. Repetir el mismo curl: `invalid_grant`.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/oauth src/app/admin/login
git commit -m "feat(oauth): registro, consentimiento y canje de tokens"
```

---

### Task 7: La ruta MCP, todavía sin herramientas

Punto de control: acá el conector se puede agregar en claude.ai y conectar. Verificar el OAuth contra el cliente real **antes** de construir las herramientas evita rehacerlas si el handshake tiene una sorpresa.

**Files:**
- Modify: `package.json` (dependencias)
- Create: `src/app/api/mcp/route.ts`

**Interfaces:**
- Consumes: `verificarAccessToken` (Tarea 4), `urlDelMcp` (Tarea 5).
- Produces: el handler MCP en `/api/mcp`, protegido.

- [ ] **Step 1: Instalar las dependencias**

Run: `npm install mcp-handler@^2 @modelcontextprotocol/server@^2 zod@^4`

- [ ] **Step 2: Crear la ruta**

Crea `src/app/api/mcp/route.ts`:

```ts
import { createMcpHandler, withMcpAuth } from 'mcp-handler'
import { db } from '@/lib/db/client'
import { verificarAccessToken } from '@/lib/oauth/store'

const handler = createMcpHandler(
  () => {
    // Las herramientas llegan en la Tarea 11.
  },
  { serverInfo: { name: 'melo-banana', version: '1.0.0' } },
)

/**
 * Sin token válido la respuesta es 401 con `WWW-Authenticate` apuntando al documento
 * de recurso protegido — es lo único que le dice a Claude dónde descubrir el resto.
 * `withMcpAuth` arma ese header; nosotros solo decimos si el token sirve.
 */
async function verificar(_req: Request, bearer?: string) {
  if (!bearer) return undefined
  const info = await verificarAccessToken(db, bearer)
  if (!info) return undefined
  return { token: bearer, clientId: info.clientId, scopes: info.scope.split(' ') }
}

const protegido = withMcpAuth(handler, verificar, {
  required: true,
  resourceMetadataPath: '/.well-known/oauth-protected-resource',
})

export { protegido as GET, protegido as POST }
```

- [ ] **Step 3: Verificar que sin token da 401 con el header correcto**

Run: `npm run dev`, y en otra terminal:

```bash
curl -s -i -X POST http://localhost:3000/api/mcp \
  -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | head -12
```

Expected: `HTTP/1.1 401` y una línea `WWW-Authenticate: Bearer resource_metadata="…/.well-known/oauth-protected-resource"`.

- [ ] **Step 4: Verificar que con token sí entra**

Usando el `access_token` obtenido en la Tarea 6:

```bash
curl -s -X POST http://localhost:3000/api/mcp \
  -H "authorization: Bearer <ACCESS_TOKEN>" \
  -H 'content-type: application/json' -H 'accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

Expected: 200 con una lista de herramientas vacía.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src/app/api/mcp
git commit -m "feat(mcp): endpoint protegido por OAuth, sin herramientas todavía"
```

- [ ] **Step 6: PUNTO DE CONTROL — verificación contra claude.ai**

Requiere una persona y una cuenta; no se puede automatizar.

1. Desplegar (`MCP_PUBLIC_URL` seteada en Vercel).
2. En claude.ai: Settings → Connectors → Add custom connector → pegar `https://forms-melo-banana.vercel.app/api/mcp` → Add.
3. Connect. Debería aparecer el login del panel, después la pantalla de consentimiento, y volver a claude.ai conectado.

Si esto funciona, la parte riesgosa está resuelta y las herramientas son trabajo mecánico. **No sigas a la Tarea 8 sin pasar este punto.**

---

### Task 8: Resolver un proyecto por nombre o id

**Files:**
- Create: `src/lib/mcp/errores.ts`
- Create: `src/lib/mcp/resolver.ts`
- Test: `src/lib/mcp/resolver.test.ts`

**Interfaces:**
- Consumes: `listProjects`, `normalizeCompanyName` de `@/lib/db/store`; `esUuidValido` de `@/lib/landscape/ids`.
- Produces:
  - `class ErrorDeHerramienta extends Error`
  - `resolverProyecto(db, ref: string): Promise<{ id: string; name: string }>`

- [ ] **Step 1: Escribe el test que falla**

Crea `src/lib/mcp/resolver.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { makeTestDb } from '@/lib/db/testdb'
import { findOrCreateProject } from '@/lib/db/store'
import { ErrorDeHerramienta } from './errores'
import { resolverProyecto } from './resolver'

describe('mcp · resolver proyecto', () => {
  it('encuentra por nombre exacto', async () => {
    const db = await makeTestDb()
    const p = await findOrCreateProject(db, 'Fruta Viva')
    expect(await resolverProyecto(db, 'Fruta Viva')).toEqual({ id: p.id, name: 'Fruta Viva' })
  })

  it('encuentra sin importar mayúsculas ni espacios de más', async () => {
    const db = await makeTestDb()
    const p = await findOrCreateProject(db, 'Fruta Viva')
    expect((await resolverProyecto(db, '  fruta viva ')).id).toBe(p.id)
  })

  it('encuentra por id', async () => {
    const db = await makeTestDb()
    const p = await findOrCreateProject(db, 'Fruta Viva')
    expect((await resolverProyecto(db, p.id)).id).toBe(p.id)
  })

  it('cuando no existe, el error lista los que sí', async () => {
    const db = await makeTestDb()
    await findOrCreateProject(db, 'Fruta Viva')
    await findOrCreateProject(db, 'Cafe Lunar')
    await expect(resolverProyecto(db, 'Inexistente')).rejects.toThrow(ErrorDeHerramienta)
    await expect(resolverProyecto(db, 'Inexistente')).rejects.toThrow(/Fruta Viva/)
    await expect(resolverProyecto(db, 'Inexistente')).rejects.toThrow(/Cafe Lunar/)
  })

  it('un uuid con forma válida que no existe también avisa', async () => {
    const db = await makeTestDb()
    await expect(resolverProyecto(db, '00000000-0000-4000-8000-000000000000'))
      .rejects.toThrow(ErrorDeHerramienta)
  })
})
```

- [ ] **Step 2: Corre el test para verificar que falla**

Run: `npx vitest run src/lib/mcp/resolver.test.ts`
Expected: FAIL — no existen `./errores` ni `./resolver`.

- [ ] **Step 3: Implementa**

Crea `src/lib/mcp/errores.ts`:

```ts
/**
 * Lo que se le devuelve a Claude como error de herramienta. El mensaje es para que
 * corrija solo: dice qué se esperaba, no solo que algo falló.
 */
export class ErrorDeHerramienta extends Error {
  constructor(mensaje: string) {
    super(mensaje)
    this.name = 'ErrorDeHerramienta'
  }
}
```

Crea `src/lib/mcp/resolver.ts`:

```ts
import type { AnyDb } from '@/lib/db/store'
import { listProjects, normalizeCompanyName } from '@/lib/db/store'
import { esUuidValido } from '@/lib/landscape/ids'
import { ErrorDeHerramienta } from './errores'

/**
 * Claude va a escribir el nombre de la marca como lo dijo la persona en el chat, no un
 * uuid. Si no acierta, el error lista los proyectos que existen: así corrige en el mismo
 * turno en vez de inventar un id.
 */
export async function resolverProyecto(db: AnyDb, ref: string): Promise<{ id: string; name: string }> {
  const buscado = (ref ?? '').trim()
  const proyectos = await listProjects(db)

  // `listProjects` devuelve solo { id, name }, así que la comparación normaliza el
  // nombre de cada proyecto en vez de leer `normalized_name` de la fila.
  const encontrado = esUuidValido(buscado)
    ? proyectos.find((p: { id: string }) => p.id === buscado)
    : proyectos.find((p: { name: string }) =>
        normalizeCompanyName(p.name) === normalizeCompanyName(buscado))

  if (encontrado) return { id: encontrado.id, name: encontrado.name }

  const lista = proyectos.map(p => p.name).join(', ')
  throw new ErrorDeHerramienta(
    proyectos.length
      ? `No existe el proyecto “${buscado}”. Los que hay son: ${lista}.`
      : `No existe el proyecto “${buscado}”, y todavía no hay ninguno cargado.`,
  )
}
```

- [ ] **Step 4: Corre el test**

Run: `npx vitest run src/lib/mcp/resolver.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/mcp/errores.ts src/lib/mcp/resolver.ts src/lib/mcp/resolver.test.ts
git commit -m "feat(mcp): resolver un proyecto por nombre o por id"
```

---

### Task 9: Validar el contenido de la etapa Tendencias

**Files:**
- Create: `src/lib/mcp/validar.ts`
- Test: `src/lib/mcp/validar.test.ts`

**Interfaces:**
- Consumes: `StageKey`, `EJES` de `@/lib/landscape/stages`; `ErrorDeHerramienta` (Tarea 8).
- Produces: `validarContenidoEtapa(etapa: StageKey, contenido: unknown): void`

- [ ] **Step 1: Escribe el test que falla**

Crea `src/lib/mcp/validar.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { ErrorDeHerramienta } from './errores'
import { validarContenidoEtapa } from './validar'

const buena = {
  candidatas: [
    { id: 't1', eje: 'Marca', titulo: 'Longevidad', descripcion: 'Algo', fuentes: [] },
  ],
}

describe('mcp · validar contenido', () => {
  it('las otras etapas aceptan cualquier objeto', () => {
    expect(() => validarContenidoEtapa('contexto', { lo_que_sea: 1 })).not.toThrow()
  })

  it('ninguna etapa acepta algo que no sea objeto', () => {
    expect(() => validarContenidoEtapa('contexto', 'texto')).toThrow(ErrorDeHerramienta)
    expect(() => validarContenidoEtapa('contexto', null)).toThrow(ErrorDeHerramienta)
    expect(() => validarContenidoEtapa('contexto', [])).toThrow(ErrorDeHerramienta)
  })

  it('acepta una long list bien formada', () => {
    expect(() => validarContenidoEtapa('tendencias', buena)).not.toThrow()
  })

  it('rechaza tendencias sin candidatas', () => {
    expect(() => validarContenidoEtapa('tendencias', {})).toThrow(/candidatas/)
    expect(() => validarContenidoEtapa('tendencias', { candidatas: [] })).toThrow(/candidatas/)
  })

  it('rechaza una candidata sin id', () => {
    expect(() => validarContenidoEtapa('tendencias', {
      candidatas: [{ eje: 'Marca', titulo: 'X', descripcion: 'Y' }],
    })).toThrow(/id/)
  })

  it('rechaza ids repetidos, porque la selección se guarda por id', () => {
    expect(() => validarContenidoEtapa('tendencias', {
      candidatas: [
        { id: 't1', eje: 'Marca', titulo: 'X', descripcion: 'Y', fuentes: [] },
        { id: 't1', eje: 'Marca', titulo: 'Z', descripcion: 'W', fuentes: [] },
      ],
    })).toThrow(/repetid/)
  })

  it('rechaza un eje que no es de los tres', () => {
    expect(() => validarContenidoEtapa('tendencias', {
      candidatas: [{ id: 't1', eje: 'Otro', titulo: 'X', descripcion: 'Y', fuentes: [] }],
    })).toThrow(/eje/)
  })

  it('rechaza que Claude escriba la selección: esa decisión es del equipo', () => {
    expect(() => validarContenidoEtapa('tendencias', { ...buena, seleccionadas: ['t1'] }))
      .toThrow(/seleccionadas/)
  })
})
```

- [ ] **Step 2: Corre el test para verificar que falla**

Run: `npx vitest run src/lib/mcp/validar.test.ts`
Expected: FAIL — no existe `./validar`.

- [ ] **Step 3: Implementa**

Crea `src/lib/mcp/validar.ts`:

```ts
import { EJES, type StageKey } from '@/lib/landscape/stages'
import { ErrorDeHerramienta } from './errores'

/**
 * Cinco de las seis etapas guardan lo que venga: el panel las renderiza genéricamente
 * y una humana las lee. Tendencias es distinta — el gate no lee texto, recorre
 * `candidatas` y guarda la selección como una lista de ids. Con otra forma el panel
 * muestra el contenido pero el gate deja de funcionar, y el gate es la etapa.
 *
 * Validar acá pone el error donde sale gratis: Claude todavía tiene el turno y reintenta.
 */
export function validarContenidoEtapa(etapa: StageKey, contenido: unknown): void {
  if (typeof contenido !== 'object' || contenido === null || Array.isArray(contenido))
    throw new ErrorDeHerramienta('El contenido tiene que ser un objeto JSON.')

  if (etapa !== 'tendencias') return

  const { candidatas, seleccionadas } = contenido as Record<string, unknown>

  if (seleccionadas !== undefined)
    throw new ErrorDeHerramienta(
      'No escribas “seleccionadas”: elegir las 4 o 5 tendencias es una decisión del equipo ' +
      'y se hace desde el panel. Mandá solo la long list en “candidatas”.',
    )

  if (!Array.isArray(candidatas) || candidatas.length === 0)
    throw new ErrorDeHerramienta(
      'La etapa Tendencias necesita “candidatas”: una lista con la long list completa. ' +
      'Cada tendencia lleva id, eje, titulo, descripcion y fuentes.',
    )

  const vistos = new Set<string>()
  candidatas.forEach((c, i) => {
    if (typeof c !== 'object' || c === null)
      throw new ErrorDeHerramienta(`La candidata ${i + 1} tiene que ser un objeto.`)
    const t = c as Record<string, unknown>

    if (typeof t.id !== 'string' || !t.id.trim())
      throw new ErrorDeHerramienta(
        `A la candidata ${i + 1} le falta un “id” de texto. El id es lo que guarda la ` +
        'selección del equipo, así que tiene que ser estable y único.',
      )
    if (vistos.has(t.id))
      throw new ErrorDeHerramienta(`El id “${t.id}” está repetido: cada tendencia necesita el suyo.`)
    vistos.add(t.id)

    if (typeof t.eje !== 'string' || !EJES.includes(t.eje as (typeof EJES)[number]))
      throw new ErrorDeHerramienta(
        `La candidata “${t.id}” tiene un eje inválido. Los válidos son: ${EJES.join(', ')}.`,
      )
    for (const campo of ['titulo', 'descripcion'] as const)
      if (typeof t[campo] !== 'string' || !(t[campo] as string).trim())
        throw new ErrorDeHerramienta(`A la candidata “${t.id}” le falta “${campo}”.`)
  })
}
```

- [ ] **Step 4: Corre el test**

Run: `npx vitest run src/lib/mcp/validar.test.ts`
Expected: PASS (8 tests)

- [ ] **Step 5: Verifica las comillas tipográficas**

Run: `rg -n $'“' src/lib/mcp/validar.ts`
Expected: encuentra las comillas curvas de los mensajes.

- [ ] **Step 6: Commit**

```bash
git add src/lib/mcp/validar.ts src/lib/mcp/validar.test.ts
git commit -m "feat(mcp): validar la long list de tendencias al escribirla"
```

---

### Task 10: Las cuatro herramientas

**Files:**
- Create: `src/lib/mcp/tools.ts`
- Test: `src/lib/mcp/tools.test.ts`

**Interfaces:**
- Consumes: `resolverProyecto` (Tarea 8), `validarContenidoEtapa` (Tarea 9), y del store: `listProjectsWithCounts`, `getProjectWithSessions`, `getDeliverable`, `landscapeState`, `summarizeLandscape`, `saveLandscapeVersion`, `getCurrentVersion`.
- Produces:
  - `listarProyectos(db)`
  - `contextoProyecto(db, ref: string)`
  - `estadoLandscape(db, ref: string)`
  - `guardarEtapa(db, d: { proyecto: string; etapa: string; contenido: unknown })`

- [ ] **Step 1: Escribe el test que falla**

Crea `src/lib/mcp/tools.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { makeTestDb } from '@/lib/db/testdb'
import { findOrCreateProject, landscapeState, listLandscapeVersions, approveLandscapeVersion, saveLandscapeVersion } from '@/lib/db/store'
import { ErrorDeHerramienta } from './errores'
import { listarProyectos, contextoProyecto, estadoLandscape, guardarEtapa } from './tools'

describe('mcp · herramientas', () => {
  it('lista los proyectos con su avance', async () => {
    const db = await makeTestDb()
    await findOrCreateProject(db, 'Fruta Viva')
    const lista = await listarProyectos(db)
    expect(lista).toHaveLength(1)
    expect(lista[0]).toMatchObject({ nombre: 'Fruta Viva', landscape: { aprobadas: 0, total: 6 } })
  })

  it('el contexto trae la marca y el estado del landscape', async () => {
    const db = await makeTestDb()
    await findOrCreateProject(db, 'Fruta Viva')
    const ctx = await contextoProyecto(db, 'Fruta Viva')
    expect(ctx.marca).toBe('Fruta Viva')
    expect(ctx.landscape).toHaveLength(6)
  })

  it('guardar_etapa crea un borrador, nunca algo aprobado', async () => {
    const db = await makeTestDb()
    const p = await findOrCreateProject(db, 'Fruta Viva')
    await guardarEtapa(db, { proyecto: 'Fruta Viva', etapa: 'contexto', contenido: { datos: 'x' } })

    const versiones = await listLandscapeVersions(db, p.id, 'contexto')
    expect(versiones).toHaveLength(1)
    expect(versiones[0].approvedAt).toBeNull()
    expect(versiones[0].author).toBe('claude')
  })

  it('sobre una etapa aprobada, no la pisa ni la reabre', async () => {
    const db = await makeTestDb()
    const p = await findOrCreateProject(db, 'Fruta Viva')
    const v = await saveLandscapeVersion(db, p.id, 'contexto', { content: { datos: 'viejo' }, author: 'humano' })
    await approveLandscapeVersion(db, v.id, { projectId: p.id, stage: 'contexto' })

    const r = await guardarEtapa(db, { proyecto: 'Fruta Viva', etapa: 'contexto', contenido: { datos: 'nuevo' } })

    const estado = (await landscapeState(db, p.id)).find(e => e.stage === 'contexto')!
    expect(estado.status).toBe('aprobada')
    expect(estado.borradorNuevo).not.toBeNull()
    expect(r.esperandoAprobacion).toBe(true)
  })

  it('rechaza una etapa que no existe, y dice cuáles hay', async () => {
    const db = await makeTestDb()
    await findOrCreateProject(db, 'Fruta Viva')
    await expect(guardarEtapa(db, { proyecto: 'Fruta Viva', etapa: 'inventada', contenido: {} }))
      .rejects.toThrow(ErrorDeHerramienta)
  })

  it('rechaza una long list mal formada antes de tocar la base', async () => {
    const db = await makeTestDb()
    const p = await findOrCreateProject(db, 'Fruta Viva')
    await expect(guardarEtapa(db, {
      proyecto: 'Fruta Viva', etapa: 'tendencias', contenido: { candidatas: [{ titulo: 'sin id' }] },
    })).rejects.toThrow(ErrorDeHerramienta)
    expect(await listLandscapeVersions(db, p.id, 'tendencias')).toHaveLength(0)
  })

  it('estado_landscape marca las seis etapas', async () => {
    const db = await makeTestDb()
    await findOrCreateProject(db, 'Fruta Viva')
    const estado = await estadoLandscape(db, 'Fruta Viva')
    expect(estado.etapas).toHaveLength(6)
    expect(estado.etapas[0]).toMatchObject({ etapa: 'setup', estado: 'pendiente' })
  })
})
```

- [ ] **Step 2: Corre el test para verificar que falla**

Run: `npx vitest run src/lib/mcp/tools.test.ts`
Expected: FAIL — no existe `./tools`.

- [ ] **Step 3: Implementa**

Crea `src/lib/mcp/tools.ts`:

```ts
import type { AnyDb } from '@/lib/db/store'
import {
  listProjectsWithCounts, getProjectWithSessions, getSessionWithAnswers, getDeliverable,
  landscapeState, summarizeLandscape, saveLandscapeVersion,
} from '@/lib/db/store'
import { STAGE_LABEL, STAGE_ORDER, type StageKey } from '@/lib/landscape/stages'
import { ErrorDeHerramienta } from './errores'
import { resolverProyecto } from './resolver'
import { validarContenidoEtapa } from './validar'

export async function listarProyectos(db: AnyDb) {
  const proyectos = await listProjectsWithCounts(db)
  return Promise.all(proyectos.map(async p => ({
    id: p.id,
    nombre: p.name,
    entrevistas: p.sessionsTotal,
    entrevistasCompletas: p.sessionsCompleted,
    tienePropuestaDeValor: p.tieneEntregable,
    landscape: summarizeLandscape(await landscapeState(db, p.id)),
  })))
}

/**
 * Todo el contexto de un proyecto, entero y sin búsqueda. A esta escala son unas pocas
 * decenas de respuestas: entra completo y no hay riesgo de que se le escape algo por
 * un ranking que decidió mal.
 */
export async function contextoProyecto(db: AnyDb, ref: string) {
  const { id, name } = await resolverProyecto(db, ref)
  const proyecto = await getProjectWithSessions(db, id)
  const entregable = await getDeliverable(db, id)
  const estado = await landscapeState(db, id)

  // `getProjectWithSessions` trae las sesiones sin sus respuestas: sin este paso las
  // entrevistas llegarían vacías, que es justamente el material que Claude necesita.
  const entrevistas = await Promise.all(
    ((proyecto?.sessions ?? []) as { id: string }[]).map(async s => {
      const conRespuestas = await getSessionWithAnswers(db, s.id)
      return {
        ...s,
        respuestas: (conRespuestas?.answers ?? []).map((a: Record<string, unknown>) => ({
          pregunta: a.questionId,
          // La normalizada es la que se leyó y limpió; la cruda es el respaldo.
          texto: a.normalizedText ?? a.rawText,
          imagen: a.imageChoice ?? null,
        })),
      }
    }),
  )

  return {
    marca: name,
    entrevistas,
    propuestaDeValor: entregable?.content ?? null,
    landscape: estado.map(e => ({
      etapa: e.stage,
      titulo: STAGE_LABEL[e.stage],
      estado: e.status,
      // Solo lo aprobado: un borrador sin aprobar todavía no es la versión que manda.
      contenidoAprobado: e.aprobada ? e.actual?.content ?? null : null,
    })),
  }
}

export async function estadoLandscape(db: AnyDb, ref: string) {
  const { id, name } = await resolverProyecto(db, ref)
  const estado = await landscapeState(db, id)
  return {
    marca: name,
    resumen: summarizeLandscape(estado),
    etapas: estado.map(e => ({
      etapa: e.stage,
      titulo: STAGE_LABEL[e.stage],
      estado: e.status,
      versiones: e.versiones,
      hayBorradorEsperandoAprobacion: e.borradorNuevo !== null,
      bloqueo: bloqueoDe(e.stage, e.status),
    })),
  }
}

function bloqueoDe(stage: StageKey, status: string): string | null {
  if (status === 'aprobada' || status === 'no_aplica') return null
  if (stage === 'tendencias')
    return 'Necesita que el equipo elija 4 o 5 tendencias de la long list, desde el panel.'
  return 'Necesita que el equipo apruebe una versión desde el panel.'
}

export async function guardarEtapa(db: AnyDb, d: {
  proyecto: string; etapa: string; contenido: unknown
}) {
  if (!STAGE_ORDER.includes(d.etapa as StageKey))
    throw new ErrorDeHerramienta(
      `“${d.etapa}” no es una etapa del landscape. Las etapas son: ${STAGE_ORDER.join(', ')}.`,
    )
  const etapa = d.etapa as StageKey

  // Validar antes de resolver el proyecto y antes de tocar la base: una escritura mal
  // formada no deja rastro.
  validarContenidoEtapa(etapa, d.contenido)

  const { id, name } = await resolverProyecto(db, d.proyecto)
  const antes = (await landscapeState(db, id)).find(e => e.stage === etapa)
  const yaEstabaAprobada = antes?.aprobada ?? false

  // Siempre borrador, siempre autor 'claude'. No hay herramienta que apruebe: aprobar
  // es un acto humano y vive en el panel. `author_label` va vacío porque la app tiene
  // una sola contraseña compartida y ninguna identidad de usuario que atribuir.
  const version = await saveLandscapeVersion(db, id, etapa, {
    content: d.contenido,
    author: 'claude',
  })

  return {
    versionId: version.id,
    marca: name,
    etapa,
    esperandoAprobacion: true,
    mensaje: yaEstabaAprobada
      ? `Guardé un borrador nuevo de ${STAGE_LABEL[etapa]}. La etapa sigue aprobada con la ` +
        'versión anterior: el borrador queda visible en el panel para que el equipo decida ' +
        'si lo aprueba. No pisé nada.'
      : `Guardé un borrador de ${STAGE_LABEL[etapa]}. Queda pendiente de aprobación: el ` +
        'equipo la aprueba desde el panel.',
  }
}
```

Si `listProjectsWithCounts` no devuelve los campos `sessions` y `deliverable` con esos nombres, ajustá el mapeo a los que sí devuelve — no cambies la firma del store.

- [ ] **Step 4: Corre el test**

Run: `npx vitest run src/lib/mcp/tools.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/mcp/tools.ts src/lib/mcp/tools.test.ts
git commit -m "feat(mcp): las cuatro herramientas sobre el store"
```

---

### Task 11: Registrar las herramientas y las instrucciones para claude.ai

**Files:**
- Modify: `src/app/api/mcp/route.ts`
- Create: `docs/fase2/instrucciones-claude-ai.md`

**Interfaces:**
- Consumes: las cuatro funciones de la Tarea 10.

- [ ] **Step 1: Registrar las herramientas**

En `src/app/api/mcp/route.ts`, reemplaza el callback vacío de `createMcpHandler`:

```ts
import { z } from 'zod'
import { createMcpHandler, withMcpAuth } from 'mcp-handler'
import { db } from '@/lib/db/client'
import { verificarAccessToken } from '@/lib/oauth/store'
import { ErrorDeHerramienta } from '@/lib/mcp/errores'
import { listarProyectos, contextoProyecto, estadoLandscape, guardarEtapa } from '@/lib/mcp/tools'
import { STAGE_ORDER } from '@/lib/landscape/stages'

/**
 * Devuelve el error como resultado de herramienta y no como excepción: así Claude lo
 * lee y reintenta en el mismo turno, que es todo el punto de validar acá.
 */
async function responder(fn: () => Promise<unknown>) {
  try {
    return { content: [{ type: 'text' as const, text: JSON.stringify(await fn(), null, 2) }] }
  } catch (e) {
    if (e instanceof ErrorDeHerramienta)
      return { content: [{ type: 'text' as const, text: e.message }], isError: true }
    throw e
  }
}

const handler = createMcpHandler(
  server => {
    server.registerTool('listar_proyectos', {
      title: 'Listar proyectos',
      description:
        'Devuelve todos los proyectos del estudio con su marca, cuántas entrevistas tienen y ' +
        'cuánto avanzó su landscape. Llamá a esto primero cuando la persona mencione una marca ' +
        'o un proyecto y no sepas cuál es, en vez de suponer el nombre.',
      inputSchema: z.object({}),
    }, async () => responder(() => listarProyectos(db)))

    server.registerTool('contexto_proyecto', {
      title: 'Contexto de un proyecto',
      description:
        'Trae todo el contexto de un proyecto, entero: la marca, las entrevistas con sus ' +
        'respuestas, la propuesta de valor y el estado del landscape con el contenido de las ' +
        'etapas aprobadas. Llamá a esto al empezar a trabajar en un proyecto, antes de escribir ' +
        'nada, para no repetir lo que ya se decidió.',
      inputSchema: z.object({
        proyecto: z.string().describe('Nombre de la marca o id del proyecto'),
      }),
    }, async ({ proyecto }) => responder(() => contextoProyecto(db, proyecto)))

    server.registerTool('estado_landscape', {
      title: 'Estado del landscape',
      description:
        'Qué etapa está en curso, cuál está aprobada, si hay un borrador esperando aprobación y ' +
        'qué bloquea el avance. Llamá a esto cuando pregunten en qué va el landscape o qué falta.',
      inputSchema: z.object({
        proyecto: z.string().describe('Nombre de la marca o id del proyecto'),
      }),
    }, async ({ proyecto }) => responder(() => estadoLandscape(db, proyecto)))

    server.registerTool('guardar_etapa', {
      title: 'Guardar una etapa del landscape',
      description:
        'Guarda el resultado de una etapa del landscape en la plataforma. **Llamá a esto cada vez ' +
        'que termines de redactar una etapa**, sin esperar a que te lo pidan: si no la guardás, el ' +
        'trabajo se queda solo en este chat y no llega al panel del estudio. Siempre entra como ' +
        'borrador — vos nunca aprobás, el equipo aprueba desde el panel. Para la etapa "tendencias" ' +
        'mandá la long list completa en "candidatas", cada una con id, eje (Marca, Estrategia o ' +
        'Comunicación), titulo, descripcion y fuentes; no mandes "seleccionadas", que elegir las ' +
        '4 o 5 principales es decisión del equipo.',
      inputSchema: z.object({
        proyecto: z.string().describe('Nombre de la marca o id del proyecto'),
        etapa: z.enum(STAGE_ORDER as [string, ...string[]]).describe('Etapa del landscape'),
        contenido: z.record(z.string(), z.unknown()).describe('El resultado de la etapa, como objeto JSON'),
      }),
    }, async ({ proyecto, etapa, contenido }) =>
      responder(() => guardarEtapa(db, { proyecto, etapa, contenido })))
  },
  { serverInfo: { name: 'melo-banana', version: '1.0.0' } },
)
```

El resto del archivo (`verificar`, `withMcpAuth`, los exports) queda igual.

- [ ] **Step 2: Verificar que las herramientas aparecen**

Run: `npm run dev`, y con el `access_token` de antes:

```bash
curl -s -X POST http://localhost:3000/api/mcp \
  -H "authorization: Bearer <ACCESS_TOKEN>" \
  -H 'content-type: application/json' -H 'accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | head -40
```

Expected: las cuatro herramientas con sus descripciones.

- [ ] **Step 3: Probar con un cliente MCP real**

Run: `npx @modelcontextprotocol/inspector`, conectar a `http://localhost:3000/api/mcp`, hacer el flujo de OAuth y ejercitar las cuatro. Probar en particular: `guardar_etapa` en `tendencias` con una candidata sin `id` (tiene que devolver el error legible) y después bien formada.

- [ ] **Step 4: Medir si Claude llama sola a `guardar_etapa`**

Conectá el servidor a Claude Code:

```bash
claude mcp add --transport http melo-banana http://localhost:3000/api/mcp
```

En una sesión nueva, pedile que redacte el contexto del sector de un proyecto sembrado (`npm run seed:landscape -- "M&B"`) **sin decirle que lo guarde**. Si no llama a `guardar_etapa` sola, endurecé la descripción de la herramienta y repetí. Ese ajuste es parte de esta tarea, no una mejora futura: si la herramienta no se dispara, el círculo no cierra.

- [ ] **Step 5: Escribir las instrucciones para M&B**

Crea `docs/fase2/instrucciones-claude-ai.md` con el bloque que se pega en las instrucciones del proyecto de claude.ai:

```markdown
# Instrucciones para el proyecto de claude.ai

Pegar esto en las instrucciones del proyecto donde M&B trabaja el landscape.

---

Tenés conectada la plataforma de Mellow & Banana por el conector “melo-banana”.

Al empezar a trabajar sobre una marca, llamá a `contexto_proyecto` antes de escribir nada:
ahí están las entrevistas, la propuesta de valor y lo que ya se aprobó del landscape. Si no
sabés a qué proyecto se refieren, usá `listar_proyectos`.

Cada vez que termines de redactar una etapa, guardala con `guardar_etapa` sin esperar a que
te lo pidan. Lo que no se guarda se queda en el chat y no llega al panel del estudio.

Vos nunca aprobás nada: todo lo que escribís entra como borrador y el equipo lo aprueba
desde el panel. Para la etapa de tendencias, mandá la long list completa — elegir las 4 o 5
principales es decisión del equipo.
```

- [ ] **Step 6: Corre la suite entera**

Run: `npm test`
Expected: PASS, sin regresiones.

- [ ] **Step 7: Commit**

```bash
git add src/app/api/mcp/route.ts docs/fase2/instrucciones-claude-ai.md
git commit -m "feat(mcp): registrar las cuatro herramientas y las instrucciones para claude.ai"
```

- [ ] **Step 8: Verificación final contra claude.ai**

Desplegar, reconectar el conector si hace falta, y correr el flujo real: pedirle a Claude que trabaje una etapa de un proyecto de prueba y confirmar que aparece en `/admin/projects/<id>/landscape` como borrador, sin haber aprobado nada.
