import { db } from '@/lib/db/client'
import { getSessionWithAnswers } from '@/lib/db/store'
import { ensureNormalized } from '@/lib/normalize/service'
import { SCRIPT } from '@/lib/script/questions'
import { AdminBar } from '@/components/AdminBar'

export const dynamic = 'force-dynamic'
const promptOf = (qid: string) => SCRIPT.flatMap(s => s.questions).find(q => q.id === qid)?.prompt ?? qid

type Answer = { id: string; questionId: string; rawText: string; normalizedText?: string | null; imageChoice?: string | null }

export default async function Detail({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params
  const full = await getSessionWithAnswers(db, sessionId)
  if (!full) return <>
    <AdminBar />
    <main className="mx-auto max-w-3xl p-8 pt-24 text-center text-[15px] text-[#8a8170]">No encontrado.</main>
  </>
  await ensureNormalized(db, sessionId)
  const fresh = await getSessionWithAnswers(db, sessionId)
  return <>
    <AdminBar />
    <main className="mx-auto w-full max-w-3xl space-y-8 p-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <header>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#b08a1e]">Respondiente</p>
          <h1 className="mt-2 font-serif text-3xl font-medium leading-tight text-ink">{full.company} · {full.name}</h1>
        </header>
        <a href={`/api/sessions/${sessionId}/pdf`}
          className="flex shrink-0 items-center gap-1.5 rounded-xl border border-[var(--ink)]/20 px-4 py-2 text-sm font-semibold text-ink transition-colors hover:border-[var(--ink)]">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M12 3v12m0 0l-4-4m4 4l4-4M4 21h16" />
          </svg>
          Descargar PDF
        </a>
      </div>
      <section className="rounded-2xl border border-black/5 bg-white p-6 shadow-sm">
        <div className="divide-y divide-black/5">
          {(fresh!.answers as Answer[]).map(a => (
            <div key={a.id} className="py-3 first:pt-0 last:pb-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#8a8170]">{promptOf(a.questionId)}</p>
              <p className="mt-1 text-[15px] text-ink">{(a.normalizedText ?? a.rawText)}{a.imageChoice ? ` (${a.imageChoice})` : ''}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  </>
}
