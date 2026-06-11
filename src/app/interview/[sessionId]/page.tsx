'use client'
import { use, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { allQuestions } from '@/lib/script/flow'
import { InterviewScreen } from '@/components/InterviewScreen'
import { BrowserVoice } from '@/lib/voice/browser-voice'

export default function InterviewPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = use(params)
  const router = useRouter()
  const questions = allQuestions().filter(q => q.id !== 'nombre' && q.id !== 'empresa' && q.id !== 'cargo' && q.id !== 'email')
  const [i, setI] = useState(0)
  const q = questions[i]
  const voice = useMemo(() => new BrowserVoice(), [])

  async function answer(a: { rawText: string; imageChoice?: string }) {
    await fetch(`/api/sessions/${sessionId}/answers`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ questionId: q.id, ...a }),
    })
    if (i + 1 < questions.length) setI(i + 1)
    else {
      await fetch(`/api/sessions/${sessionId}/complete`, { method: 'POST' })
      router.push('/gracias')
    }
  }

  return <InterviewScreen question={q} index={i + 1} total={questions.length} voice={voice} onAnswer={answer} />
}
