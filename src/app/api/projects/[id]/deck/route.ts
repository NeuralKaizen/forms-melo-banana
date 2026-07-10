import { createElement } from 'react'
import type { ReactElement } from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import type { DocumentProps } from '@react-pdf/renderer'
import { buildProjectDeckView } from '@/lib/deck/service'
import { DeckDocument } from '@/lib/deck/DeckDocument'

export const runtime = 'nodejs'

function slug(name: string): string {
  const out = (name || '')
    .toLowerCase()
    .normalize('NFD').replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return out || 'taller'
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const view = await buildProjectDeckView(id)
  if (!view) return new Response('Sin entregable generado', { status: 404 })

  const buffer = await renderToBuffer(createElement(DeckDocument, { view }) as ReactElement<DocumentProps>)
  return new Response(new Uint8Array(buffer), {
    headers: {
      'content-type': 'application/pdf',
      'content-disposition': `attachment; filename="taller-${slug(view.marca)}.pdf"`,
    },
  })
}
