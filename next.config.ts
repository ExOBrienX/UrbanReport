/**
 * next.config.js — Configuracion de Next.js con soporte PWA.
 *
 * withPWA envuelve la configuracion para registrar automaticamente
 * un Service Worker que cachea los assets estaticos de la aplicacion,
 * permitiendo instalacion en pantalla de inicio y carga mas rapida
 * en visitas posteriores.
 *
 * El Service Worker se genera solo en build de produccion (disable: dev)
 * para no interferir con el hot-reload durante el desarrollo local.
 *
 * Depende de: @ducanh2912/next-pwa
 */

import withPWAInit from '@ducanh2912/next-pwa'

const withPWA = withPWAInit({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  workboxOptions: {
    disableDevLogs: true,
  },
})

const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Permissions-Policy',
            value: 'camera=*, geolocation=*',
          },
        ],
      },
    ]
  },
}

export default withPWA(nextConfig)