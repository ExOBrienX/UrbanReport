import L from 'leaflet'
import { useEffect } from 'react'

interface MapControlsProps {
  map: L.Map
  onReportClick: () => void
  onThemeChange?: (isDark: boolean) => void
}

export default function MapControls({ map, onReportClick, onThemeChange }: MapControlsProps) {
  useEffect(() => {
    // Botón toggle tema oscuro/claro
    const toggleBtn = new L.Control({ position: 'topright' })
    toggleBtn.onAdd = () => {
      const btn = L.DomUtil.create('button')
      btn.innerHTML = '☀️ Modo claro'
      btn.style.cssText = 'padding:8px 12px;background:white;border:none;border-radius:6px;cursor:pointer;font-size:14px;box-shadow:0 2px 6px rgba(0,0,0,0.3)'
      
      const darkLayer = L.tileLayer(
        'https://tile.jawg.io/jawg-dark/{z}/{x}/{y}{r}.png?access-token=' + process.env.NEXT_PUBLIC_JAWG_TOKEN,
        { attribution: '<a href="https://jawg.io">Jawg Maps</a>' }
      )
      const lightLayer = L.tileLayer(
        'https://tile.jawg.io/jawg-streets/{z}/{x}/{y}{r}.png?access-token=' + process.env.NEXT_PUBLIC_JAWG_TOKEN,
        { attribution: '<a href="https://jawg.io">Jawg Maps</a>' }
      )
      darkLayer.addTo(map)

      let dark = true
      const updateButtonStyle = () => {
        if (dark) {
          btn.style.background = 'white'
          btn.style.color = 'black'
        } else {
          btn.style.background = '#1e293b'
          btn.style.color = 'white'
        }
      }
      updateButtonStyle() // Inicial

      btn.onclick = () => {
        if (dark) {
          map.removeLayer(darkLayer)
          lightLayer.addTo(map)
          btn.innerHTML = '🌙 Modo oscuro'
        } else {
          map.removeLayer(lightLayer)
          darkLayer.addTo(map)
          btn.innerHTML = '☀️ Modo claro'
        }
        dark = !dark
        updateButtonStyle()
        onThemeChange?.(dark)
      }
      return btn
    }
    toggleBtn.addTo(map)

    // Botón reportar
    const reportBtn = new L.Control({ position: 'bottomright' })
    reportBtn.onAdd = () => {
      const btn = L.DomUtil.create('button')
      btn.innerHTML = '📋 Reportar'
      btn.style.cssText = 'padding:12px 16px;background:#1e293b;border:none;border-radius:6px;cursor:pointer;font-size:14px;font-weight:600;color:white;box-shadow:0 4px 12px rgba(0,0,0,0.3);transition:background 0.2s;transform:translateY(-40px);'
      btn.onclick = onReportClick
      btn.onmouseover = () => (btn.style.background = '#0f172a')
      btn.onmouseout = () => (btn.style.background = '#1e293b')
      return btn
    }
    reportBtn.addTo(map)

    return () => {
      map.removeControl(toggleBtn)
      map.removeControl(reportBtn)
    }
  }, [map, onReportClick])

  return null
}
