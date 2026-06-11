import { describe, it, expect } from 'vitest'
import { buildBriefView } from './answers-view'

// Date con constructor local (TZ-independiente): 11 jun 2026
const session = { name: 'Lucía', company: 'Frutaria', role: 'CMO', email: 'lucia@frutaria.com', completedAt: new Date(2026, 5, 11) }

describe('buildBriefView', () => {
  it('mapea encabezado, secciones de texto (faltante → —) y chips proyectivos', () => {
    const answers = [
      { questionId: 'empresa_historia', rawText: 'Jugos desde 2018', imageChoice: null },
      { questionId: 'animal', rawText: '', imageChoice: 'leon' },
      { questionId: 'color', rawText: '', imageChoice: 'amarillo' },
      { questionId: 'genero', rawText: '', imageChoice: 'mujer' },
      { questionId: 'edad_mujer', rawText: '', imageChoice: '30s' },
      { questionId: 'edad_hombre', rawText: '', imageChoice: '40s' }, // stale: debe ignorarse
    ]
    const v = buildBriefView(session, answers)

    expect(v.company).toBe('Frutaria')
    expect(v.contact).toBe('Lucía · CMO')
    expect(v.email).toBe('lucia@frutaria.com')
    expect(v.date).toBe('11 jun 2026')

    const proj = v.sections.find(s => s.title === 'Contexto del proyecto')!
    expect(proj.items.find(i => i.prompt.includes('descripción'))!.answer).toBe('Jugos desde 2018')
    expect(proj.items.find(i => i.prompt.includes('estrategia'))!.answer).toBe('—')

    expect(v.projective.find(c => c.label === 'Animal')!.value).toBe('León')
    const color = v.projective.find(c => c.label === 'Color')!
    expect(color.value).toBe('Amarillo')
    expect(color.swatch).toBe('#EAB308')

    const edades = v.projective.filter(c => c.label === 'Edad')
    expect(edades).toHaveLength(1)
    expect(edades[0].value).toBe("30's")
  })

  it('empresa vacía y sin fecha degradan limpio', () => {
    const v = buildBriefView({ name: null, company: null, role: null, email: null, completedAt: null }, [])
    expect(v.company).toBe('(sin empresa)')
    expect(v.contact).toBe('')
    expect(v.email).toBe('')
    expect(v.date).toBe('')
    expect(v.projective).toEqual([])
  })
})
