import { DefaultSession } from 'next-auth'
import { DefaultJWT } from 'next-auth/jwt'

declare module 'next-auth' {
  interface User {
    rol: 'admin' | 'tecnico'
    nombre: string
  }

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
  interface JWT extends DefaultJWT {
    role: 'admin' | 'tecnico'
    nombre: string
  }
}