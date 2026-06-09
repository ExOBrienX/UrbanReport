/**
 * auth.ts — Configuracion de NextAuth para autenticacion con credenciales.
 *
 * Implementa autenticacion basada en email y password usando JWT.
 * Solo usuarios existentes en la tabla 'usuarios' pueden iniciar sesion —
 * no hay registro publico. Los tecnicos son creados por el admin.
 *
 * Flujo de autenticacion:
 *   1. Usuario envia email y password desde /acceso
 *   2. authorize() busca el usuario en BD y verifica la password con bcrypt
 *   3. Si es valido, NextAuth genera un JWT con role y nombre
 *   4. El JWT se almacena en una cookie httpOnly por 8 horas
 *   5. El middleware lee el JWT para proteger rutas /admin y /tecnico
 *
 * El campo se llama 'rol' en BD pero 'role' en el token y la sesion —
 * la conversion ocurre en los callbacks jwt() y session().
 *
 * Depende de: prisma, bcryptjs, next-auth
 */

import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { prisma } from './prisma'

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email:    { label: 'Email',    type: 'email' },
        password: { label: 'Password', type: 'password' }
      },

      /**
       * Valida las credenciales contra la BD.
       * Retorna null (fallo silencioso) en vez de lanzar error
       * para no exponer si el email existe o no.
       */
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        const user = await prisma.usuario.findUnique({
          where: { email: credentials.email }
        })

        // Rechazar si no existe o fue desactivado por el admin
        if (!user || !user.activo) return null

        const isPasswordValid = await bcrypt.compare(credentials.password, user.password_hash)
        if (!isPasswordValid) return null

        return {
          id:     user.id.toString(),
          email:  user.email,
          nombre: user.nombre,
          rol:    user.rol as 'admin' | 'tecnico'
        }
      }
    })
  ],

  session: {
    strategy: 'jwt',
    maxAge: 8 * 60 * 60, // 8 horas — duracion de una jornada laboral
  },

  callbacks: {
    /**
     * Enriquece el JWT con role y nombre al iniciar sesion.
     * Solo se ejecuta cuando 'user' esta presente (primer login).
     * En requests posteriores solo llega 'token'.
     */
    async jwt({ token, user }) {
      if (user) {
        token.role  = user.rol as 'admin' | 'tecnico'
        token.nombre = user.nombre as string
      }
      return token
    },

    /**
     * Expone role, nombre e id en la sesion accesible desde el cliente.
     * Sin este callback, session.user solo tendria email y name por defecto.
     */
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id     = token.sub!
        session.user.role   = token.role as 'admin' | 'tecnico'
        session.user.nombre = token.nombre as string
      }
      return session
    }
  },

  // Redirigir a /acceso en vez de la pagina de login por defecto de NextAuth
  pages: {
    signIn: '/acceso'
  }
}