/**
 * app/layout.tsx — Layout raiz de la aplicacion Next.js.
 *
 * Define la estructura HTML base que envuelve todas las paginas.
 * Configura las fuentes globales (Geist Sans y Geist Mono), los metadatos
 * del sitio (incluyendo manifest PWA e iconos) y el proveedor de sesion
 * de NextAuth.
 *
 * Providers envuelve toda la app con SessionProvider, lo que permite
 * acceder a useSession() desde cualquier componente cliente sin prop drilling.
 *
 * Depende de: Providers, next/font/google, public/manifest.json
 */

import type { Metadata, Viewport } from "next"
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
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "UrbanReport",
  },
  icons: {
    icon: [
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
}

export const viewport: Viewport = {
  themeColor: "#0A0F1E",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
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