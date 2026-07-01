'use client'
import type { SectionView } from '@/lib/script/flow'
import { Wordmark } from './Brand'

export function SectionNav({ sections, currentIndex, answeredIds, onJump }: {
  sections: SectionView[]
  currentIndex: number
  answeredIds: Set<string>
  onJump: (index: number) => void
}) {
  const activeKey = sections.find(s => s.questions.some(q => q.index === currentIndex))?.key
  const active = sections.find(s => s.key === activeKey)
  const activeLocal = active?.questions.find(q => q.index === currentIndex)?.localNumber ?? 1

  return (
    <>
      {/* Desktop: stepper vertical — modo principal para moverse por la entrevista */}
      <nav aria-label="Navegación por preguntas" className="hidden md:flex md:flex-col">
        <div className="mb-11 flex items-center gap-2">
          <span aria-hidden="true" className="text-xl leading-none">🍌</span>
          <Wordmark className="text-sm text-ink" />
        </div>
        <ol className="flex flex-col">
          {sections.map((section, si) => {
            const isActive = section.key === activeKey
            const answered = section.questions.filter(q => answeredIds.has(q.question.id)).length
            const total = section.questions.length
            const isDone = answered === total && !isActive
            const isLast = si === sections.length - 1
            return (
              <li key={section.key} className="relative flex gap-3 pb-9 last:pb-0">
                {/* Conector vertical del stepper (sin animación) */}
                {!isLast && (
                  <span aria-hidden="true" className="absolute left-[11px] top-7 bottom-1 w-px bg-black/10" />
                )}
                <span
                  aria-hidden="true"
                  className={`relative z-10 grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-bold transition ${
                    isActive
                      ? 'bg-[var(--banana)] text-ink'
                      : isDone
                        ? 'bg-[var(--ink)] text-white'
                        : 'bg-black/[0.06] text-[#cfc7b4]'
                  }`}
                >
                  {isDone ? '✓' : si + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p
                      aria-current={isActive ? 'step' : undefined}
                      className={`text-[11px] font-semibold uppercase tracking-[0.12em] ${
                        isActive ? 'text-ink' : 'text-[#bcb29c]'
                      }`}
                    >
                      {section.title}
                    </p>
                    <span className="shrink-0 text-[10px] font-semibold tabular-nums text-[#cfc7b4]">
                      {answered}/{total}
                    </span>
                  </div>
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {section.questions.map(({ question, index, localNumber }) => {
                      const isCurrent = index === currentIndex
                      const clickable = answeredIds.has(question.id) && !isCurrent
                      return (
                        <button
                          key={question.id}
                          type="button"
                          disabled={!clickable && !isCurrent}
                          aria-current={isCurrent ? 'step' : undefined}
                          aria-label={`${section.title}: pregunta ${localNumber}`}
                          onClick={() => { if (clickable) onJump(index) }}
                          className={[
                            'grid h-8 w-8 place-items-center rounded-lg text-xs font-bold transition',
                            isCurrent
                              ? 'bg-[var(--banana)] text-ink shadow-sm'
                              : clickable
                                ? 'bg-black/[0.06] text-ink hover:bg-black/10 active:scale-95'
                                : 'cursor-not-allowed bg-black/[0.03] text-[#cfc7b4]',
                          ].join(' ')}
                        >
                          {localNumber}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </li>
            )
          })}
        </ol>
      </nav>

      {/* Móvil: tira de segmentos por sección */}
      <nav aria-label="Progreso por secciones" className="md:hidden">
        <div className="flex gap-1.5">
          {sections.map(section => {
            const total = section.questions.length
            const isActive = section.key === activeKey
            const isPast = !isActive && section.questions.every(q => answeredIds.has(q.question.id))
            const fillPct = isActive
              ? Math.round((activeLocal / total) * 100)
              : isPast ? 100 : 0
            return (
              <button
                key={section.key}
                type="button"
                disabled={!isPast}
                aria-label={section.title}
                onClick={() => { if (isPast) onJump(section.questions[0].index) }}
                style={{ flexGrow: total, flexBasis: 0 }}
              >
                <span className="block h-[5px] overflow-hidden rounded-full bg-black/10">
                  <span className="block h-full rounded-full bg-[var(--banana)]" style={{ width: `${fillPct}%` }} />
                </span>
              </button>
            )
          })}
        </div>
        {active && (
          <>
            <div className="mt-2 flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink">
                <span aria-hidden="true" className="text-sm leading-none">🍌</span> {active.title}
              </span>
              <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#bcb29c]">
                {activeLocal} de {active.questions.length}
              </span>
            </div>
            {/* Puntos de la sección activa: tocar una respondida te devuelve a ella */}
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {active.questions.map(({ question, index, localNumber }) => {
                const isCurrent = index === currentIndex
                const clickable = answeredIds.has(question.id) && !isCurrent
                return (
                  <button
                    key={question.id}
                    type="button"
                    disabled={!clickable && !isCurrent}
                    aria-current={isCurrent ? 'step' : undefined}
                    aria-label={`${active.title}: pregunta ${localNumber}`}
                    onClick={() => { if (clickable) onJump(index) }}
                    className={[
                      'grid h-8 w-8 place-items-center rounded-lg text-xs font-bold transition',
                      isCurrent
                        ? 'bg-[var(--banana)] text-ink shadow-sm'
                        : clickable
                          ? 'bg-black/[0.06] text-ink active:scale-95'
                          : 'cursor-not-allowed bg-black/[0.03] text-[#cfc7b4]',
                    ].join(' ')}
                  >
                    {localNumber}
                  </button>
                )
              })}
            </div>
          </>
        )}
      </nav>
    </>
  )
}
