import { SCRIPT } from '@/lib/script/questions'

export interface TextItem { prompt: string; answer: string }
export interface Chip { label: string; value: string; swatch?: string }
export interface BriefView {
  company: string
  contact: string
  date: string
  sections: { title: string; items: TextItem[] }[]
  projective: Chip[]
}

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
function fmtDate(d?: Date | null): string {
  if (!d) return ''
  return `${String(d.getDate()).padStart(2, '0')} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

const CHIP_LABEL: Record<string, string> = {
  animal: 'Animal', color: 'Color', genero: 'Género',
  edad_hombre: 'Edad', edad_mujer: 'Edad', olor: 'Olor', ciudad: 'Ciudad',
}

export function buildBriefView(
  session: { name?: string | null; company?: string | null; role?: string | null; completedAt?: Date | null },
  answers: { questionId: string; rawText: string; imageChoice?: string | null }[],
): BriefView {
  const byId = new Map(answers.map(a => [a.questionId, a]))
  const genero = byId.get('genero')?.imageChoice ?? undefined

  const sections: { title: string; items: TextItem[] }[] = []
  const projective: Chip[] = []

  for (const sec of SCRIPT) {
    if (sec.key === 'identity') continue

    if (sec.key === 'projective') {
      for (const q of sec.questions) {
        // edad: solo la variante que coincide con el género elegido (ignora la stale)
        if (q.id === 'edad_hombre' && genero === 'mujer') continue
        if (q.id === 'edad_mujer' && genero !== 'mujer') continue
        const a = byId.get(q.id)
        if (!a || (!a.rawText && !a.imageChoice)) continue
        const opt = q.options?.find(o => o.id === a.imageChoice)
        const chip: Chip = { label: CHIP_LABEL[q.id] ?? q.id, value: opt?.label ?? a.imageChoice ?? '' }
        if (q.type === 'color-grid' && opt?.colors?.length) {
          chip.swatch = opt.colors[Math.floor(opt.colors.length / 2)]
        }
        projective.push(chip)
      }
      continue
    }

    const items: TextItem[] = sec.questions
      .filter(q => q.type === 'open')
      .map(q => ({ prompt: q.prompt, answer: (byId.get(q.id)?.rawText ?? '').trim() || '—' }))
    sections.push({ title: sec.title, items })
  }

  return {
    company: session.company || '(sin empresa)',
    contact: [session.name, session.role].filter(Boolean).join(' · '),
    date: fmtDate(session.completedAt ?? null),
    sections,
    projective,
  }
}
