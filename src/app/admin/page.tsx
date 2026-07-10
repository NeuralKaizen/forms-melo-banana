import Link from 'next/link'
import { db } from '@/lib/db/client'
import { listProjects } from '@/lib/db/store'
import { AdminBar } from '@/components/AdminBar'

export const dynamic = 'force-dynamic'

export default async function Admin() {
  const projects = await listProjects(db) as { id: string; name: string }[]
  return <>
    <AdminBar />
    <main className="mx-auto w-full max-w-3xl p-8">
      <h1 className="font-serif text-3xl font-medium leading-tight text-ink">
        <span className="underline-banana">Proyectos</span>
      </h1>
      {projects.length === 0 && (
        <p className="mt-16 text-center text-[15px] text-[#8a8170]">
          Todavía no hay proyectos. Se crean al completarse una entrevista.
        </p>
      )}
      <ul className="mt-8 space-y-3">
        {projects.map(p => (
          <li key={p.id}>
            <Link href={`/admin/projects/${p.id}`}
              className="flex items-center justify-between rounded-2xl border border-black/5 bg-white px-5 py-4 shadow-sm transition-colors hover:border-[var(--banana)]">
              <span className="font-medium text-ink">{p.name}</span>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" className="text-[#a59c89]" aria-hidden="true">
                <path d="M9 6l6 6-6 6" />
              </svg>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  </>
}
