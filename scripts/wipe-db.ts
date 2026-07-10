import { db } from '../src/lib/db/client'
import { sessions, answers } from '../src/lib/db/schema'

async function main() {
  const before = {
    sessions: (await db.select().from(sessions)).length,
    answers: (await db.select().from(answers)).length,
  }
  console.log('Antes:', before)

  // Borrar respetando las FKs: answers apunta a sessions.
  await db.delete(answers)
  await db.delete(sessions)

  const after = {
    sessions: (await db.select().from(sessions)).length,
    answers: (await db.select().from(answers)).length,
  }
  console.log('Después:', after)
  console.log('Base de datos limpia ✅')
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e)
  process.exit(1)
})
