import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { isValidAdminToken } from '@/lib/admin/auth'

export function proxy(req: NextRequest) {
  if (req.nextUrl.pathname.startsWith('/admin') && !req.nextUrl.pathname.startsWith('/admin/login')) {
    if (!isValidAdminToken(req.cookies.get('admin')?.value)) {
      return NextResponse.redirect(new URL('/admin/login', req.url))
    }
  }
  return NextResponse.next()
}
export const config = { matcher: ['/admin/:path*'] }
