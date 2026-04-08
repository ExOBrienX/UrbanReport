// types/next-auth.d.ts
import 'next-auth'
import 'next-auth/jwt'

declare module 'next-auth' {
  interface User {
    rol?: 'admin' | 'tecnico'   // ← valores exactos del enum
  }
  interface Session {
    user: {
      id: string
      email: string
      role?: 'admin' | 'tecnico'
    }
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    role?: 'admin' | 'tecnico'
  }
}