import type { PartKey } from '@/lib/deliverable/schema'

export type SectionNumber = 1 | 2 | 3

/** Qué partes del Deliverable alimentan cada sección impresa del documento, con el label de su botón de regenerar. */
export function partsOfSection(numero: SectionNumber): { key: PartKey; label: string }[] {
  if (numero === 1) return [{ key: 'problema', label: 'Regenerar' }]
  if (numero === 2) return [{ key: 'competencia', label: 'Regenerar' }]
  return [
    { key: 'perfil', label: 'Regenerar perfil' },
    { key: 'propuestaValor', label: 'Regenerar propuesta de valor' },
  ]
}
