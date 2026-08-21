'use client'
import { useRouter } from 'next/navigation'
import { IdentityForm } from '@/components/IdentityForm'

export default function Home() {
  const router = useRouter()
  async function start(v: { name: string; company: string; role: string; email: string }) {
    // El link que manda el estudio trae el proyecto (`/?p=<id>`): la sesión nace ya
    // asignada y no depende de cómo escriba la empresa quien responde.
    const projectId = new URLSearchParams(window.location.search).get('p') ?? undefined
    const res = await fetch('/api/sessions', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...v, projectId }),
    })
    const { id } = await res.json()
    router.push(`/interview/${id}`)
  }
  return <IdentityForm onSubmit={start} />
}
