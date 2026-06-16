'use client'
import type { SectionView } from '@/lib/script/flow'
import { Wordmark, BananaGlyph } from './Brand'

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
      {/* Desktop: riel vertical */}
      <nav aria-label="Navegación por preguntas" className="hidden md:flex md:flex-col md:gap-6">
        <div className="flex items-center gap-2">
          <BananaGlyph size={22} />
          <Wordmark className="text-sm text-ink" />
        </div>
        {sections.map(section => (
          <div key={section.key}>
            <p
              aria-current={section.key === activeKey ? 'step' : undefined}
              className={`text-[11px] font-semibold uppercase tracking-[0.12em] ${
                section.key === activeKey ? 'text-ink' : 'text-[#bcb29c]'
              }`}
            >
              {section.title}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
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
                      'grid h-7 w-7 place-items-center rounded-full text-xs font-bold transition',
                      isCurrent
                        ? 'bg-[var(--banana)] text-ink'
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
        ))}
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
          <div className="mt-2 flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink">
              <BananaGlyph size={14} /> {active.title}
            </span>
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#bcb29c]">
              {activeLocal} de {active.questions.length}
            </span>
          </div>
        )}
      </nav>
    </>
  )
}
