import Link from 'next/link'
import { db } from '@/lib/db/client'
import { listProjects } from '@/lib/db/store'

export const dynamic = 'force-dynamic'

export default async function Admin() {
  const projects = await listProjects(db) as { id: string; name: string }[]
  return <main className="mx-auto max-w-2xl p-8">
    <h1 className="mb-6 text-2xl font-bold text-ink">Proyectos</h1>
    {projects.length === 0 && <p className="text-black/50">Todavía no hay proyectos. Se crean al completarse una entrevista.</p>}
    <ul className="divide-y">
      {projects.map(p => (
        <li key={p.id} className="py-3">
          <Link href={`/admin/projects/${p.id}`} className="font-medium hover:underline">{p.name}</Link>
        </li>
      ))}
    </ul>
  </main>
}
