'use client' // Necesario para usar dynamic con ssr: false en Next.js 15

import { useState } from 'react'
import dynamic from 'next/dynamic'
import Header from './components/ui/Header'

// Cargamos el mapa de forma dinámica solo en el cliente
// ssr: false evita que Leaflet intente ejecutarse en el servidor,
// ya que Leaflet depende de objetos del navegador como window y document
// que no existen en el servidor
const CityMap = dynamic(() => import('./components/map/CityMap'), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center h-screen">Cargando mapa...</div> // Mensaje mientras carga el mapa
})

export default function Home() {
  const [isDarkMode, setIsDarkMode] = useState(true) // Inicia en modo oscuro

  return (
    <div className="min-h-screen">
      <Header isDarkMode={isDarkMode} />
      <main className="pt-16"> {/* Espacio para el header fijo */}
        <CityMap onThemeChange={setIsDarkMode} />
      </main>
    </div>
  )
}