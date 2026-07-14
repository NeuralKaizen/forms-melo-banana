import { db } from '../src/lib/db/client'
import { projects, sessions, deliverables } from '../src/lib/db/schema'
async function main() {
  const ps = await db.select().from(projects)
  const ss = await db.select().from(sessions)
  const ds = await db.select().from(deliverables)
  console.log(`proyectos (${ps.length}):`)
  for (const p of ps) console.log(`  - ${p.name}  [${p.id}]  sesiones: ${ss.filter(s => s.projectId === p.id).length}  entregable: ${ds.some(d => d.projectId === p.id) ? 'sí' : 'no'}`)
  console.log(`sesiones totales: ${ss.length}`)
}
main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1) })
