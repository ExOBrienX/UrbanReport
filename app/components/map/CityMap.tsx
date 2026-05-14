'use client'

import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
// @ts-ignore
import 'leaflet/dist/leaflet.css'
import ReportModal from '../ReportModal'

const getColor = (estado: string) => {
  switch (estado) {
    case 'pendiente_revision': return '#94a3b8'
    case 'pendiente': return '#ef4444'
    case 'asignado': return '#f97316'
    case 'en_curso': return '#f97316'
    case 'completado': return '#22c55e'
    default: return '#94a3b8'
  }
}

export default function CityMap() {
  const [isDark, setIsDark] = useState(true)
  const [isReportModalOpen, setIsReportModalOpen] = useState(false)
  const mapRef = useRef<L.Map | null>(null)
  const markersRef = useRef<L.CircleMarker[]>([])

  // Función que carga y actualiza los marcadores en el mapa
  const loadReportes = () => {
    if (!mapRef.current) return

    // Limpiar marcadores anteriores
    markersRef.current.forEach(m => m.remove())
    markersRef.current = []

    fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/reports`)
      .then(res => res.json())
      .then(data => {
        if (!data.reportes || !mapRef.current) return
        data.reportes.forEach((reporte: any) => {
          const color = getColor(reporte.estado)
          const marker = L.circleMarker(
            [parseFloat(reporte.latitud), parseFloat(reporte.longitud)],
            {
              radius: 10,
              fillColor: color,
              color: '#ffffff',
              weight: 2,
              opacity: 1,
              fillOpacity: 0.9
            }
          )
          .bindPopup(`
  <div style="min-width:200px">
    <img src="${reporte.foto_url}" 
      style="width:100%;height:120px;object-fit:cover;border-radius:6px;margin-bottom:8px" 
      alt="Foto del reporte"
    />
    <b style="text-transform:capitalize">${reporte.estado.replace('_', ' ')}</b>
    <p style="margin:4px 0;font-size:13px">${reporte.descripcion}</p>
  </div>
`)
          .addTo(mapRef.current!)
          markersRef.current.push(marker)
        })
      })
      .catch(err => console.error('Error cargando reportes:', err))
  }

  useEffect(() => {
    const map = L.map('map').setView([-35.4264, -71.6554], 13)
    mapRef.current = map

    const darkLayer = L.tileLayer(
      'https://tile.jawg.io/jawg-dark/{z}/{x}/{y}{r}.png?access-token=' + process.env.NEXT_PUBLIC_JAWG_TOKEN,
      { attribution: '<a href="https://jawg.io">Jawg Maps</a>' }
    )

    const lightLayer = L.tileLayer(
      'https://tile.jawg.io/jawg-streets/{z}/{x}/{y}{r}.png?access-token=' + process.env.NEXT_PUBLIC_JAWG_TOKEN,
      { attribution: '<a href="https://jawg.io">Jawg Maps</a>' }
    )

    darkLayer.addTo(map)

    const toggleBtn = new L.Control({ position: 'topright' })
    toggleBtn.onAdd = () => {
      const btn = L.DomUtil.create('button')
      btn.innerHTML = '☀️ Modo claro'
      btn.style.cssText = 'padding:8px 12px;background:white;border:none;border-radius:6px;cursor:pointer;font-size:14px;box-shadow:0 2px 6px rgba(0,0,0,0.3)'
      let dark = true
      btn.onclick = () => {
        if (dark) {
          map.removeLayer(darkLayer)
          lightLayer.addTo(map)
          btn.innerHTML = 'Modo oscuro'
        } else {
          map.removeLayer(lightLayer)
          darkLayer.addTo(map)
          btn.innerHTML = 'Modo claro'
        }
        dark = !dark
      }
      return btn
    }
    toggleBtn.addTo(map)

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

    // Cargar reportes al iniciar
    loadReportes()

    // Polling cada 30 segundos
    const interval = setInterval(loadReportes, 30000)

    return () => {
      clearInterval(interval) // Limpiar el polling al desmontar
      mapRef.current = null
      map.remove()
    }
  }, [])

  // Cuando se cierra el modal recarga los reportes inmediatamente
  const handleModalClose = () => {
    setIsReportModalOpen(false)
    loadReportes()
  }

  return (
    <>
      <div
        id="map"
        style={{ width: '100%', height: '100vh' }}
      />
      <ReportModal
        isOpen={isReportModalOpen}
        onClose={handleModalClose}
      />
    </>
  )
}