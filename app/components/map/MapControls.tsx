/**
 * MapControls.tsx — Controles personalizados superpuestos sobre el mapa Leaflet.
 *
 * Agrega dos botones como controles nativos de Leaflet (L.Control):
 *
 *   1. Toggle tema — cambia entre mapa oscuro (Jawg Dark) y claro (Jawg Streets).
 *      Notifica al componente padre (CityMap → Header) para sincronizar el tema
 *      del header con el del mapa.
 *
 *   2. Botón "Reportar" — abre el modal de creación de reporte ciudadano.
 *      Posicionado en la parte inferior derecha, sobre los controles de zoom.
 *
 * Se usan L.Control nativos en vez de elementos React para que Leaflet
 * gestione su posición y z-index correctamente dentro del canvas del mapa.
 *
 * El useEffect limpia ambos controles al desmontar para evitar duplicados
 * si el componente se remonta (ej: hot reload en desarrollo).
 *
 * Usado por: app/components/map/CityMap.tsx
 * Depende de: Leaflet, NEXT_PUBLIC_JAWG_TOKEN
 */

import L from 'leaflet'
import { useEffect } from 'react'

interface MapControlsProps {
  map: L.Map                          // instancia del mapa donde se agregan los controles
  onReportClick: () => void           // abre el ReportModal al hacer clic en "Reportar"
  onThemeChange?: (isDark: boolean) => void // notifica al padre cuando cambia el tema
}

export default function MapControls({ map, onReportClick, onThemeChange }: MapControlsProps) {

  useEffect(() => {

    // ── Control 1: Toggle de tema oscuro/claro ───────────────────────────────
    const toggleBtn = new L.Control({ position: 'topright' })

    toggleBtn.onAdd = () => {
      const btn = L.DomUtil.create('button')
      btn.innerHTML = 'Modo claro'
      btn.style.cssText = 'padding:8px 12px;background:white;border:none;border-radius:6px;cursor:pointer;font-size:14px;box-shadow:0 2px 6px rgba(0,0,0,0.3)'

      // Dos capas de tiles — se intercambian al hacer clic en el toggle
      const darkLayer = L.tileLayer(
        'https://tile.jawg.io/jawg-dark/{z}/{x}/{y}{r}.png?access-token=' + process.env.NEXT_PUBLIC_JAWG_TOKEN,
        { attribution: '<a href="https://jawg.io">Jawg Maps</a>' }
      )
      const lightLayer = L.tileLayer(
        'https://tile.jawg.io/jawg-streets/{z}/{x}/{y}{r}.png?access-token=' + process.env.NEXT_PUBLIC_JAWG_TOKEN,
        { attribution: '<a href="https://jawg.io">Jawg Maps</a>' }
      )

      // El mapa inicia en modo oscuro
      darkLayer.addTo(map)
      let dark = true

      // Actualiza el estilo visual del botón según el tema activo
      const updateButtonStyle = () => {
        if (dark) {
          btn.style.background = 'white'
          btn.style.color = 'black'
        } else {
          btn.style.background = '#1e293b'
          btn.style.color = 'white'
        }
      }
      updateButtonStyle()

      btn.onclick = () => {
        if (dark) {
          // Cambiar a modo claro
          map.removeLayer(darkLayer)
          lightLayer.addTo(map)
          btn.innerHTML = 'Modo oscuro'
        } else {
          // Cambiar a modo oscuro
          map.removeLayer(lightLayer)
          darkLayer.addTo(map)
          btn.innerHTML = 'Modo claro'
        }
        dark = !dark
        updateButtonStyle()
        onThemeChange?.(dark) // notificar al Header para sincronizar su tema
      }

      return btn
    }
    toggleBtn.addTo(map)

    // ── Control 2: Botón "Reportar" ──────────────────────────────────────────
    const reportBtn = new L.Control({ position: 'bottomright' })

    reportBtn.onAdd = () => {
      const btn = L.DomUtil.create('button')
      btn.innerHTML = 'Reportar'
      btn.style.cssText = [
        'padding:12px 16px',
        'background:#1e293b',
        'border:none',
        'border-radius:6px',
        'cursor:pointer',
        'font-size:14px',
        'font-weight:600',
        'color:white',
        'box-shadow:0 4px 12px rgba(0,0,0,0.3)',
        'transition:background 0.2s',
        'transform:translateY(-40px)' // elevar sobre los controles de zoom de Leaflet
      ].join(';')

      btn.onclick = onReportClick
      btn.onmouseover = () => (btn.style.background = '#0f172a')
      btn.onmouseout = () => (btn.style.background = '#1e293b')

      return btn
    }
    reportBtn.addTo(map)

    // Limpiar controles al desmontar — evita duplicados en hot reload
    return () => {
      map.removeControl(toggleBtn)
      map.removeControl(reportBtn)
    }
  }, [map, onReportClick])

  // No renderiza nada en el DOM de React — los controles los gestiona Leaflet
  return null
}