import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const { pw } = await req.json()
  if (pw !== process.env.ADMIN_PASSWORD) return NextResponse.json({ error: 'bad' }, { status: 401 })
  const res = NextResponse.json({ ok: true })
  res.cookies.set('admin', process.env.ADMIN_PASSWORD!, { httpOnly: true, sameSite: 'lax', path: '/' })
  return res
}
