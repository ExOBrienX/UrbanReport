'use client'

/**
 * Providers.tsx — Proveedor global de contexto para la aplicación.
 *
 * Envuelve toda la aplicación con SessionProvider de NextAuth,
 * lo que permite acceder a la sesión del usuario desde cualquier
 * componente usando el hook useSession() sin necesidad de pasar
 * props manualmente por el árbol de componentes.
 *
 * Usado por: app/layout.tsx
 * Depende de: next-auth/react
 */

import { SessionProvider } from 'next-auth/react'

export default function Providers({ children }: { children: React.ReactNode }) {
  // SessionProvider gestiona el estado de autenticación globalmente
  // y refresca el token automáticamente antes de que expire
  return <SessionProvider>{children}</SessionProvider>
}