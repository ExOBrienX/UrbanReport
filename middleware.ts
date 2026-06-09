/**
 * middleware.ts — Control de acceso y caché para rutas protegidas.
 *
 * Responsabilidades:
 *   - Redirigir usuarios no autenticados a /acceso
 *   - Separar acceso por rol: admin → /admin, técnico → /tecnico
 *   - Agregar headers no-cache para evitar pestañeo al cerrar sesión
 *     (sin esto, el navegador muestra la página cacheada al presionar "atrás")
 *
 * Ejecutado en el Edge Runtime antes de cada request a rutas protegidas.
 */

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

/**
 * Agrega headers HTTP que impiden que el navegador cachee la respuesta.
 * Crítico para páginas protegidas — evita que aparezcan tras cerrar sesión.
 */
function sinCache(response: NextResponse): NextResponse {
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
  response.headers.set('Pragma', 'no-cache')
  response.headers.set('Expires', '0')
  return response
}

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
    // Admin autenticado — pasar con headers no-cache
    return sinCache(NextResponse.next())
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
    // Técnico autenticado — pasar con headers no-cache
    return sinCache(NextResponse.next())
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