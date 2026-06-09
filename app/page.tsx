'use client'

/**
 * app/page.tsx — Pagina principal del mapa ciudadano.
 *
 * Punto de entrada para los ciudadanos de Talca. Muestra el mapa interactivo
 * de incidencias activas y permite crear nuevos reportes.
 *
 * CityMap se carga con dynamic import (ssr: false) porque Leaflet depende
 * de window y document que no existen en el servidor. Sin esto, Next.js
 * intentaria renderizar Leaflet en el servidor y lanzaria un error.
 *
 * El tema oscuro/claro del Header se sincroniza con el toggle del mapa
 * via la prop onThemeChange — CityMap notifica cuando el admin cambia el
 * tile layer para que el Header actualice sus colores.
 *
 * Depende de: Header, CityMap
 */

import { useState } from 'react'
import dynamic from 'next/dynamic'
import Header from './components/ui/Header'

// Carga dinamica del mapa — Leaflet requiere window y document (solo cliente)
const CityMap = dynamic(() => import('./components/map/CityMap'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-screen">
      Cargando mapa...
    </div>
  )
})

export default function Home() {
  // Inicia en modo oscuro — sincronizado con el tile layer inicial de CityMap
  const [isDarkMode, setIsDarkMode] = useState(true)

  return (
    <div className="min-h-screen">
      <Header isDarkMode={isDarkMode} />
      {/* pt-16 compensa la altura del header fijo para que el mapa no quede tapado */}
      <main className="pt-16">
        <CityMap onThemeChange={setIsDarkMode} />
      </main>
    </div>
  )
}