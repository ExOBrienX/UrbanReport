'use client' // Indica a Next.js que este componente se ejecuta solo en el navegador, no en el servidor

import { useEffect, useState } from 'react'
import L from 'leaflet' // Librería principal de Leaflet para crear mapas interactivos
// @ts-ignore
import 'leaflet/dist/leaflet.css' // Estilos base necesarios para que el mapa se vea correctamente
import ReportModal from '../ReportModal'

export default function CityMap() {
  // Estado para saber si el mapa está en modo oscuro o claro
  const [isDark, setIsDark] = useState(true)
  const [isReportModalOpen, setIsReportModalOpen] = useState(false)

  useEffect(() => {
    // Creamos el mapa centrado en Talca, Chile con zoom 13
    // -35.4264 es la latitud y -71.6554 es la longitud de Talca
    const map = L.map('map').setView([-35.4264, -71.6554], 13)

    // Capa de mapa en modo oscuro usando Jawg Maps
    // {z}/{x}/{y} son variables que Leaflet reemplaza automáticamente
    // según el nivel de zoom y la posición del mapa
    const darkLayer = L.tileLayer(
      'https://tile.jawg.io/jawg-dark/{z}/{x}/{y}{r}.png?access-token=' + process.env.NEXT_PUBLIC_JAWG_TOKEN,
      { attribution: '<a href="https://jawg.io">Jawg Maps</a>' }
    )

    // Capa de mapa en modo claro usando el estilo streets de Jawg Maps
    const lightLayer = L.tileLayer(
      'https://tile.jawg.io/jawg-streets/{z}/{x}/{y}{r}.png?access-token=' + process.env.NEXT_PUBLIC_JAWG_TOKEN,
      { attribution: '<a href="https://jawg.io">Jawg Maps</a>' }
    )

    // Agregamos la capa oscura por defecto al iniciar
    darkLayer.addTo(map)

    // Creamos un control personalizado de Leaflet para el botón de cambio de tema
    // position: 'topright' lo ubica en la esquina superior derecha del mapa
    const toggleBtn = new L.Control({ position: 'topright' })

    // onAdd se ejecuta cuando el control se agrega al mapa
    // Aquí definimos el HTML y el comportamiento del botón
    toggleBtn.onAdd = () => {
      const btn = L.DomUtil.create('button') // Creamos un elemento button en el DOM
      btn.innerHTML = '☀️ Modo claro'
      btn.style.cssText = 'padding:8px 12px;background:white;border:none;border-radius:6px;cursor:pointer;font-size:14px;box-shadow:0 2px 6px rgba(0,0,0,0.3)'

      // Variable local para rastrear el estado actual del tema
      let dark = true

      // Evento click del botón — alterna entre modo oscuro y claro
      btn.onclick = () => {
        if (dark) {
          // Si está en oscuro: removemos la capa oscura y agregamos la clara
          map.removeLayer(darkLayer)
          lightLayer.addTo(map)
          btn.innerHTML = 'Modo oscuro'
        } else {
          // Si está en claro: removemos la capa clara y agregamos la oscura
          map.removeLayer(lightLayer)
          darkLayer.addTo(map)
          btn.innerHTML = 'Modo claro'
        }
        dark = !dark // Invertimos el estado
      }
      return btn
    }

    // Agregamos el botón al mapa para testear su funcionalidad
    toggleBtn.addTo(map)

    // Crear botón flotante de reportar
    const reportBtn = new L.Control({ position: 'bottomright' })
    reportBtn.onAdd = () => {
      const btn = L.DomUtil.create('button')
      btn.innerHTML = '📋 Reportar'
      btn.style.cssText = 'padding:12px 16px;background:#1e293b;border:none;border-radius:6px;cursor:pointer;font-size:14px;font-weight:600;color:white;box-shadow:0 4px 12px rgba(0,0,0,0.3);transition:background 0.2s;transform:translateY(-40px);'
      btn.onclick = () => setIsReportModalOpen(true)
      btn.onmouseover = () => (btn.style.background = '#0f172a')
      btn.onmouseout = () => (btn.style.background = '#1e293b')
      return btn
    }
    reportBtn.addTo(map)

    // Función de limpieza: cuando el componente se desmonta
    // removemos el mapa para evitar duplicados al recargar la página
    return () => {
      map.remove()
    }
  }, []) // El array vacío indica que useEffect solo se ejecuta una vez al montar el componente

  return (
    <>
      {/* Contenedor del mapa — el id="map" es el que usa L.map('map') arriba */}
      {/* height: 100vh hace que ocupe toda la altura de la pantalla */}
      <div
        id="map"
        style={{ width: '100%', height: '100vh' }}
      />
      <ReportModal isOpen={isReportModalOpen} onClose={() => setIsReportModalOpen(false)} />
    </>
  )
}