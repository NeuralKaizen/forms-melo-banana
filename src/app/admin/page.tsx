import Link from 'next/link'
import { db } from '@/lib/db/client'
import { listCompleted } from '@/lib/db/store'

export const dynamic = 'force-dynamic'

type Session = { id: string; company?: string | null; name?: string | null; completedAt?: Date | null }

export default async function Admin() {
  const rows = await listCompleted(db) as Session[]
  return <main className="mx-auto max-w-2xl p-8">
    <h1 className="mb-6 text-2xl font-bold text-ink">Entrevistas</h1>
    <ul className="divide-y">
      {rows.map(s => (
        <li key={s.id} className="py-3">
          <Link href={`/admin/${s.id}`} className="flex justify-between">
            <span>{s.company ?? '—'} · {s.name ?? '—'}</span>
            <span className="text-black/40">{s.completedAt?.toLocaleString?.() ?? ''}</span>
          </Link>
        </li>
      ))}
    </ul>
  </main>
}
