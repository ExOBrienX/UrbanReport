// middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  })

  // ── /admin → solo rol admin ──────────────────────────────
  if (pathname.startsWith('/admin')) {
    if (!token || token.role !== 'admin') {
      return NextResponse.redirect(new URL('/acceso', request.url))
    }
  }

  // ── /tecnico → solo rol tecnico ──────────────────────────
  if (pathname.startsWith('/tecnico')) {
    if (!token || token.role !== 'tecnico') {
      return NextResponse.redirect(new URL('/acceso', request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/tecnico/:path*',
  ],
}