import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  })

  // ── /admin → solo rol admin ───────────────────────────────────────────────
  if (pathname.startsWith('/admin')) {
    if (!token) {
      return NextResponse.redirect(new URL('/acceso', request.url))
    }
    if (token.role !== 'admin') {
      // Técnico autenticado intentando entrar al admin → redirigir a su panel
      return NextResponse.redirect(new URL('/tecnico', request.url))
    }
  }

  // ── /tecnico → solo rol tecnico ───────────────────────────────────────────
  if (pathname.startsWith('/tecnico')) {
    if (!token) {
      return NextResponse.redirect(new URL('/acceso', request.url))
    }
    if (token.role !== 'tecnico') {
      // Admin intentando entrar al panel técnico → redirigir a su panel
      return NextResponse.redirect(new URL('/admin', request.url))
    }
  }

  // ── /acceso → si ya está autenticado, redirigir a su panel ───────────────
  if (pathname.startsWith('/acceso')) {
    if (token?.role === 'admin') {
      return NextResponse.redirect(new URL('/admin', request.url))
    }
    if (token?.role === 'tecnico') {
      return NextResponse.redirect(new URL('/tecnico', request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/tecnico/:path*',
    '/acceso',
  ],
}