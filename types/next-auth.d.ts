/**
 * types/next-auth.d.ts — Extension de tipos de NextAuth para TypeScript.
 *
 * Extiende las interfaces de NextAuth con los campos personalizados del sistema:
 *   - rol/role : distingue entre 'admin' y 'tecnico' para el control de acceso
 *   - nombre   : nombre completo del usuario para mostrar en la UI
 *
 * Sin esta declaracion, TypeScript no reconoce session.user.role ni
 * session.user.nombre al usarlos en componentes y middleware, generando
 * errores de tipo aunque los valores existan en tiempo de ejecucion.
 *
 * El campo se llama 'rol' en el modelo Prisma y en la interfaz User,
 * pero 'role' en Session y JWT para seguir la convencion de NextAuth.
 * La conversion ocurre en los callbacks de authOptions (app/lib/auth.ts).
 */

import { DefaultSession } from 'next-auth'
import { DefaultJWT } from 'next-auth/jwt'

declare module 'next-auth' {
  // Extiende el usuario retornado por el provider authorize()
  interface User {
    rol: 'admin' | 'tecnico'
    nombre: string
  }

  // Extiende la sesion accesible via useSession() y getServerSession()
  interface Session {
    user: {
      id: string
      email: string
      role: 'admin' | 'tecnico'
      nombre: string
    } & DefaultSession['user']
  }
}

declare module 'next-auth/jwt' {
  // Extiende el JWT almacenado en la cookie de sesion
  interface JWT extends DefaultJWT {
    role: 'admin' | 'tecnico'
    nombre: string
  }
}