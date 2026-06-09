/**
 * app/layout.tsx — Layout raiz de la aplicacion Next.js.
 *
 * Define la estructura HTML base que envuelve todas las paginas.
 * Configura las fuentes globales (Geist Sans y Geist Mono), los metadatos
 * del sitio y el proveedor de sesion de NextAuth.
 *
 * Providers envuelve toda la app con SessionProvider, lo que permite
 * acceder a useSession() desde cualquier componente cliente sin prop drilling.
 *
 * Depende de: Providers, next/font/google
 */

import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import "./globals.css"
import Providers from "./components/Provider"

// Fuente principal — sans-serif para textos generales
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

// Fuente monoespaciada — usada en IDs, codigos y datos tecnicos
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: "UrbanReport",
  description: "Sistema de reportes urbanos municipales de Talca",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* Providers inyecta el contexto de sesion NextAuth en toda la app */}
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
}