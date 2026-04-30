'use client' // Necesario para usar dynamic con ssr: false en Next.js 15

import dynamic from 'next/dynamic'

// Cargamos el mapa de forma dinámica solo en el cliente
// ssr: false evita que Leaflet intente ejecutarse en el servidor,
// ya que Leaflet depende de objetos del navegador como window y document
// que no existen en el servidor
const CityMap = dynamic(() => import('./components/map/CityMap'), {
  ssr: false,
  loading: () => <div>Cargando mapa...</div> // Mensaje mientras carga el mapa
})

export default function Home() {
  return <CityMap />
}