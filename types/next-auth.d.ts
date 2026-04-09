import NextAuth from "next-auth"

declare module "next-auth" {
  interface User {
    rol: string
  }
  interface Session {
    user: {
      id: string
      email: string
      role: string
    }
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role: string
  }
}