import { db } from '@/lib/db/client'
import { getSessionWithAnswers } from '@/lib/db/store'
import { ensureNormalized } from '@/lib/normalize/service'
import { SCRIPT } from '@/lib/script/questions'

export const dynamic = 'force-dynamic'
const promptOf = (qid: string) => SCRIPT.flatMap(s => s.questions).find(q => q.id === qid)?.prompt ?? qid

type Answer = { id: string; questionId: string; rawText: string; normalizedText?: string | null; imageChoice?: string | null }

export default async function Detail({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params
  const full = await getSessionWithAnswers(db, sessionId)
  if (!full) return <main className="p-8">No encontrado.</main>
  await ensureNormalized(db, sessionId)
  const fresh = await getSessionWithAnswers(db, sessionId)
  return <main className="mx-auto max-w-2xl space-y-8 p-8">
    <div className="flex items-center justify-between gap-4">
      <h1 className="text-2xl font-bold text-ink">{full.company} · {full.name}</h1>
      <a href={`/api/sessions/${sessionId}/pdf`}
        className="shrink-0 rounded-xl bg-[var(--ink)] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90">
        Descargar PDF
      </a>
    </div>
    <section>
      <h2 className="mb-2 font-bold">Respuestas</h2>
      {(fresh!.answers as Answer[]).map(a => (
        <div key={a.id} className="mb-3">
          <p className="text-sm text-black/50">{promptOf(a.questionId)}</p>
          <p>{(a.normalizedText ?? a.rawText)}{a.imageChoice ? ` (${a.imageChoice})` : ''}</p>
        </div>
      ))}
    </section>
  </main>
}
