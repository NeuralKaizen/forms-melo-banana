import { NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import { completeSession, getSessionWithAnswers, findOrCreateProject, assignSessionToProject } from '@/lib/db/store'

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const s = await completeSession(db, id)
  try {
    const full = await getSessionWithAnswers(db, id)
    const company = full?.company?.trim()
    if (company) {
      const project = await findOrCreateProject(db, company)
      await assignSessionToProject(db, id, project.id)
    }
  } catch (e) {
    console.error('auto-assign de proyecto falló:', e)
  }
  return NextResponse.json({ status: s.status })
}
