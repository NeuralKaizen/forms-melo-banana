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
  const [saved, setSaved] = useState<Record<string, { rawText: string; imageChoice?: string }>>({})
  const q = questions[i]
  const voice = useMemo(() => new BrowserVoice(), [])

  async function answer(a: { rawText: string; imageChoice?: string }) {
    setSaved(prev => ({ ...prev, [q.id]: a }))
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

  return <InterviewScreen
    question={q} index={i + 1} total={questions.length} voice={voice}
    initial={saved[q.id]} canGoBack={i > 0} onBack={() => setI(Math.max(0, i - 1))}
    onAnswer={answer} />
}
