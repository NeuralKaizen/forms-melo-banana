'use client'
import { use, useState, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { visibleQuestions, visibleSections } from '@/lib/script/flow'
import { sectionIntro } from '@/lib/script/breathers'
import { InterviewScreen } from '@/components/InterviewScreen'
import { ProjectiveScreen } from '@/components/ProjectiveScreen'
import { InterviewLayout } from '@/components/InterviewLayout'
import { Breather } from '@/components/Breather'
import { BrowserVoice } from '@/lib/voice/browser-voice'
import type { Answers } from '@/lib/script/types'

export default function InterviewPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = use(params)
  const router = useRouter()
  const [i, setI] = useState(0)
  const [saved, setSaved] = useState<Answers>({})
  const [introduced, setIntroduced] = useState<Set<string>>(() => new Set())
  const finishing = useRef(false)
  const voice = useMemo(() => new BrowserVoice(), [])

  const questions = visibleQuestions(saved)
  const q = questions[i]
  const sections = visibleSections(saved)
  const answeredIds = new Set(Object.keys(saved))

  async function finish() {
    if (finishing.current) return
    finishing.current = true
    await fetch(`/api/sessions/${sessionId}/complete`, { method: 'POST' })
    router.push('/gracias')
  }

  async function answer(a: { rawText: string; imageChoice?: string }) {
    setSaved(prev => ({ ...prev, [q.id]: a }))
    await fetch(`/api/sessions/${sessionId}/answers`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ questionId: q.id, ...a }),
    })
    // Tras la última pregunta se va derecho al cierre: una sola pantalla final.
    if (i + 1 === questions.length) { void finish(); return }
    setI(i + 1)
  }

  // Transición antes de la primera pregunta de cada sección (una sola vez).
  const intro = sectionIntro(q.id)
  if (intro && !introduced.has(q.id)) {
    return <Breather message={intro.message} closing={false} emoji={intro.emoji} cta={intro.cta}
      onContinue={() => setIntroduced(prev => new Set(prev).add(q.id))} />
  }

  const common = {
    question: q, index: i + 1, total: questions.length,
    initial: saved[q.id], canGoBack: i > 0,
    onBack: () => setI(Math.max(0, i - 1)), onAnswer: answer,
  }

  return (
    <InterviewLayout sections={sections} currentIndex={i} answeredIds={answeredIds} onJump={setI}>
      {q.type === 'open'
        ? <InterviewScreen {...common} voice={voice} />
        : <ProjectiveScreen {...common} />}
    </InterviewLayout>
  )
}
