/**
 * app/api/auth/[...nextauth]/route.ts — Handler de autenticacion NextAuth.
 *
 * Punto de entrada para todas las rutas de autenticacion de NextAuth:
 *   GET  /api/auth/signin        — pagina de inicio de sesion
 *   POST /api/auth/signin        — procesar credenciales
 *   GET  /api/auth/signout       — cerrar sesion
 *   GET  /api/auth/session       — obtener sesion activa
 *   GET  /api/auth/csrf          — token CSRF
 *
 * La logica de autenticacion (validacion de credenciales, callbacks de sesion
 * y JWT) esta centralizada en app/lib/auth.ts para mantener este archivo simple.
 *
 * force-dynamic evita que Next.js cachee las respuestas de autenticacion,
 * garantizando que la sesion siempre refleje el estado real del usuario.
 *
 * Depende de: app/lib/auth.ts
 */

import NextAuth from 'next-auth'
import { authOptions } from '../../../lib/auth'

// Forzar renderizado dinamico — las rutas de auth nunca deben cachearse
export const dynamic = 'force-dynamic'

// Un solo handler maneja tanto GET como POST para todas las rutas de NextAuth
const handler = NextAuth(authOptions)
export { handler as GET, handler as POST }