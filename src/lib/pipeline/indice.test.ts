import { describe, it, expect } from 'vitest'
import { construirIndice, esperanDecision, resolverEtapaActiva } from './indice'
import { deriveFases, derivePantallas } from './phases'
import { projectSignals } from './signals'
import { buildStages, STAGE_ORDER } from '@/lib/landscape/stages'
import { buildEtapasEstrategia, ETAPA_ORDER } from '@/lib/estrategia/stages'

const señales = projectSignals({ sessions: [], tieneEntregable: false })

const base = () => ({
  projectId: 'p1',
  fases: deriveFases('p1', señales),
  pantallas: derivePantallas('p1', señales),
  etapaActiva: 'landscape:tendencias',
  stagesLandscape: buildStages([]),
  etapasEstrategia: buildEtapasEstrategia([]),
  esperanDecision: [] as string[],
})

describe('construirIndice', () => {
  it('agrupa entrevistas, propuesta y taller como tres entradas de una sola fase', () => {
    const [primera] = construirIndice(base())
    expect(primera.label).toBe('Entrevistas / Propuesta de valor')
    expect(primera.entradas.map(e => e.key)).toEqual(['entrevistas', 'propuesta', 'taller'])
  })

  it('la fase landscape trae sus seis etapas con href propio', () => {
    const fase = construirIndice(base()).find(f => f.key === 'landscape')!
    expect(fase.entradas).toHaveLength(6)
    expect(fase.entradas[0].href).toBe('/admin/projects/p1/landscape?etapa=setup')
  })

  it('marca como actual la etapa activa y sólo esa', () => {
    const fase = construirIndice(base()).find(f => f.key === 'landscape')!
    const actuales = fase.entradas.filter(e => e.estado === 'actual')
    expect(actuales.map(e => e.key)).toEqual(['landscape:tendencias'])
  })

  it('colapsa una fase de más de seis etapas y cuenta las ocultas', () => {
    const fase = construirIndice({ ...base(), etapaActiva: 'estrategia:personalidad' })
      .find(f => f.key === 'estrategia')!
    expect(fase.entradas).toHaveLength(6)
    expect(fase.ocultas).toBe(8)
    expect(fase.entradas.some(e => e.key === 'estrategia:personalidad')).toBe(true)
  })

  it('con todas=true no colapsa nada', () => {
    const fase = construirIndice({ ...base(), etapaActiva: 'estrategia:personalidad', todas: true })
      .find(f => f.key === 'estrategia')!
    expect(fase.entradas).toHaveLength(14)
    expect(fase.ocultas).toBe(0)
  })

  it('el link a “todas” conserva la etapa activa de esa fase', () => {
    const fase = construirIndice({ ...base(), etapaActiva: 'estrategia:personalidad' })
      .find(f => f.key === 'estrategia')!
    expect(fase.hrefTodas).toBe('/admin/projects/p1/estrategia?etapa=personalidad&todas=1')
  })

  it('el link a “todas” de otra fase no inventa una etapa activa', () => {
    // Parado en el landscape, la estrategia no tiene etapa activa que preservar: revelar
    // sus ocultas no puede llevar una `?etapa=` de otra fase puesta.
    const fase = construirIndice({ ...base(), etapaActiva: 'landscape:tendencias' })
      .find(f => f.key === 'estrategia')!
    expect(fase.hrefTodas).toBe('/admin/projects/p1/estrategia?todas=1')
  })

  it('pone el rótulo del bloque en la primera etapa de cada bloque de estrategia', () => {
    // Sin colapso: con la primera etapa activa la ventana arranca en 0.
    const fase = construirIndice({ ...base(), etapaActiva: 'estrategia:diagnostico' })
      .find(f => f.key === 'estrategia')!
    expect(fase.entradas[0].bloque).toBe('Diagnóstico y consumidor')
    expect(fase.entradas[1].bloque).toBeUndefined()
  })

  it('marca espera=true sólo en las etapas que le pasaron', () => {
    const fase = construirIndice({ ...base(), esperanDecision: ['landscape:panorama'] })
      .find(f => f.key === 'landscape')!
    expect(fase.entradas.filter(e => e.espera).map(e => e.key)).toEqual(['landscape:panorama'])
  })

  it('el avance de una fase sin etapas propias sale del estado de la fase', () => {
    const [primera] = construirIndice(base())
    expect(primera.avance).toBe('Sin respondientes')
  })

  it('el avance de landscape y estrategia va siempre con barra, también con la fase completa', () => {
    const sinNada = construirIndice(base())
    expect(sinNada.find(f => f.key === 'landscape')!.avance).toBe('0/6')
    expect(sinNada.find(f => f.key === 'estrategia')!.avance).toBe('0/14')

    const completas = construirIndice({
      ...base(),
      stagesLandscape: buildStages(STAGE_ORDER.map(stage => ({ stage, status: 'aprobada' as const }))),
      etapasEstrategia: buildEtapasEstrategia(ETAPA_ORDER.map(stage => ({ stage, status: 'aprobada' as const }))),
    })
    expect(completas.find(f => f.key === 'landscape')!.avance).toBe('6/6')
    expect(completas.find(f => f.key === 'estrategia')!.avance).toBe('14/14')
  })
})

describe('resolverEtapaActiva', () => {
  const etapas = buildEtapasEstrategia([
    { stage: 'diagnostico', status: 'aprobada' },
    { stage: 'consumidor', status: 'no_aplica' },
  ])

  it('la query manda cuando nombra una etapa real', () => {
    expect(resolverEtapaActiva('territorio', ETAPA_ORDER, etapas)).toBe('territorio')
  })

  it('una query inventada cae a la primera que se puede trabajar', () => {
    expect(resolverEtapaActiva('inventada', ETAPA_ORDER, etapas)).toBe('rtbs')
  })

  it('sin query no aterriza en una no_aplica', () => {
    // 'diagnostico' está aprobada y 'consumidor' no aplica: ninguna de las dos es un
    // destino, así que arranca en la siguiente que el equipo sí puede mover.
    expect(resolverEtapaActiva(undefined, ETAPA_ORDER, etapas)).toBe('rtbs')
  })

  it('la query sí puede nombrar una no_aplica: la pidió alguien a propósito', () => {
    expect(resolverEtapaActiva('consumidor', ETAPA_ORDER, etapas)).toBe('consumidor')
  })

  it('con todo aprobado o no aplicable cae a la primera del orden', () => {
    const todas = buildEtapasEstrategia(ETAPA_ORDER.map(stage => ({ stage, status: 'aprobada' as const })))
    expect(resolverEtapaActiva(undefined, ETAPA_ORDER, todas)).toBe('diagnostico')
  })

  it('también sirve para el landscape, que tiene otro orden', () => {
    const stages = buildStages([{ stage: 'setup', status: 'aprobada' }, { stage: 'contexto', status: 'no_aplica' }])
    expect(resolverEtapaActiva(undefined, STAGE_ORDER, stages)).toBe('tendencias')
  })
})

describe('esperanDecision', () => {
  it('devuelve las etapas con versión sin aprobar, namespaceadas', () => {
    expect(esperanDecision('landscape', [
      { stage: 'setup', actual: { approvedAt: new Date() } },
      { stage: 'panorama', actual: { approvedAt: null } },
    ])).toEqual(['landscape:panorama'])
  })

  it('una etapa aprobada con borrador nuevo también espera', () => {
    expect(esperanDecision('estrategia', [
      { stage: 'personalidad', actual: { approvedAt: new Date() }, borradorNuevo: { id: 'v2' } },
    ])).toEqual(['estrategia:personalidad'])
  })

  it('una etapa sin nada guardado no espera a nadie', () => {
    expect(esperanDecision('landscape', [{ stage: 'setup', actual: null }])).toEqual([])
  })
})
