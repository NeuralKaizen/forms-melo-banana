'use client'
import { useRouter } from 'next/navigation'
import { IdentityForm } from '@/components/IdentityForm'

export default function Home() {
  const router = useRouter()
  async function start(v: { name: string; company: string; role: string; email: string }) {
    const res = await fetch('/api/sessions', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(v),
    })
    const { id } = await res.json()
    router.push(`/interview/${id}`)
  }
  return <IdentityForm onSubmit={start} />
}
