import { db } from '@/lib/db/client'
import { getSessionWithAnswers, getBrief } from '@/lib/db/store'
import { ensureNormalized } from '@/lib/normalize/service'
import { SCRIPT } from '@/lib/script/questions'

export const dynamic = 'force-dynamic'
const promptOf = (qid: string) => SCRIPT.flatMap(s => s.questions).find(q => q.id === qid)?.prompt ?? qid

type Answer = { id: string; questionId: string; rawText: string; normalizedText?: string | null; imageChoice?: string | null }

export default async function Detail({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params
  const full = await getSessionWithAnswers(db, sessionId)
  const brief = await getBrief(db, sessionId)
  if (!full) return <main className="p-8">No encontrado.</main>
  await ensureNormalized(db, sessionId)
  const fresh = await getSessionWithAnswers(db, sessionId)
  const b = brief?.content as any
  return <main className="mx-auto max-w-2xl space-y-8 p-8">
    <div className="flex items-center justify-between gap-4">
      <h1 className="text-2xl font-bold text-ink">{full.company} · {full.name}</h1>
      <a href={`/api/sessions/${sessionId}/pdf`}
        className="shrink-0 rounded-xl bg-[var(--ink)] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90">
        Descargar PDF
      </a>
    </div>
    {b && <section className="rounded-2xl bg-[var(--cream)] p-5">
      <h2 className="mb-2 font-bold">Brief</h2>
      <p className="mb-3">{b.resumen}</p>
      {b.secciones?.map((sec: any, i: number) => (
        <div key={i} className="mb-2"><strong>{sec.titulo}</strong>
          <ul className="list-disc pl-5">{sec.puntos?.map((p: string, j: number) => <li key={j}>{p}</li>)}</ul></div>
      ))}
      {b.alertas?.length > 0 && <p className="mt-2 text-amber-700">⚠ {b.alertas.join(' · ')}</p>}
    </section>}
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
