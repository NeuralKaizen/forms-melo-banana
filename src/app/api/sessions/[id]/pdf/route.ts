import { createElement } from 'react'
import type { ReactElement } from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import type { DocumentProps } from '@react-pdf/renderer'
import { db } from '@/lib/db/client'
import { getSessionWithAnswers } from '@/lib/db/store'
import { buildBriefView } from '@/lib/pdf/answers-view'
import { BriefDocument } from '@/lib/pdf/BriefDocument'
import { ensureNormalized } from '@/lib/normalize/service'

export const runtime = 'nodejs'

function slug(company: string): string {
  const out = (company || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return out || 'entrevista'
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const full = await getSessionWithAnswers(db, id)
  if (!full) return new Response('No encontrado', { status: 404 })
  const answers = await ensureNormalized(db, id)
  const view = buildBriefView(full, answers)
  const buffer = await renderToBuffer(createElement(BriefDocument, { view }) as ReactElement<DocumentProps>)
  return new Response(new Uint8Array(buffer), {
    headers: {
      'content-type': 'application/pdf',
      'content-disposition': `attachment; filename="brief-${slug(full.company ?? '')}.pdf"`,
    },
  })
}
