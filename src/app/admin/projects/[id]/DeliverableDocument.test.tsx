import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { DeliverableDocument } from './DeliverableDocument'
import type { DeckView } from '@/lib/deck/view-model'

const view: DeckView = {
  marca: 'Test',
  fecha: '10 jul 2026',
  completo: true,
  faltantes: [],
  secciones: [{
    numero: 1,
    titulo: 'Declaración del problema',
    error: null,
    blocks: [{
      titulo: 'Bloque',
      parrafo: null,
      items: [{ texto: 'Ítem', origen: 'cliente', cita: 'la cita textual' }],
    }],
    tabla: [],
    tablaError: null,
  }],
}

describe('DeliverableDocument', () => {
  // Canario: las comillas tipográficas de las citas se aplanaron a rectas en
  // tres reescrituras distintas de este archivo. El PDF usa ldquo/rdquo.
  it('las citas van entre comillas tipográficas', () => {
    const html = renderToStaticMarkup(
      <DeliverableDocument view={view} busy={null} onRegenerate={() => {}} />,
    )
    expect(html).toContain('“la cita textual”')
  })
})
