import { db } from '../src/lib/db/client'
import { projects, sessions, answers, deliverables } from '../src/lib/db/schema'
import { eq, inArray } from 'drizzle-orm'

const PROJECT_ID = process.argv[2]

async function main() {
  if (!PROJECT_ID) throw new Error('falta projectId')
  const [p] = await db.select().from(projects).where(eq(projects.id, PROJECT_ID))
  if (!p) throw new Error(`no existe el proyecto ${PROJECT_ID}`)
  const ss = await db.select().from(sessions).where(eq(sessions.projectId, PROJECT_ID))
  const ids = ss.map(s => s.id)
  console.log(`Borrando "${p.name}": ${ids.length} sesiones`)

  if (ids.length) await db.delete(answers).where(inArray(answers.sessionId, ids))
  await db.delete(deliverables).where(eq(deliverables.projectId, PROJECT_ID))
  if (ids.length) await db.delete(sessions).where(inArray(sessions.id, ids))
  await db.delete(projects).where(eq(projects.id, PROJECT_ID))
  console.log('Borrado.')
}
main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1) })
