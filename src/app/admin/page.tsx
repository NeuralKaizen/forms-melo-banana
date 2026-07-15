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
      <ul className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {projects.map(p => (
          <li key={p.id}>
            <Link href={`/admin/projects/${p.id}`}
              className="flex min-h-[9rem] flex-col justify-between rounded-2xl border border-black/5 bg-white p-6 shadow-sm transition-colors hover:border-[var(--banana)]">
              <span className="font-serif text-xl font-medium leading-snug text-ink">{p.name}</span>
              <span className="mt-4 inline-flex items-center gap-1 text-[13px] text-[#a59c89]">
                Abrir
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M9 6l6 6-6 6" />
                </svg>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  </>
}
