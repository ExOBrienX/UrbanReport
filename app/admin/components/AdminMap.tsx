'use client'

/**
 * AdminMap.tsx — Mapa de incidencias para el dashboard del administrador.
 *
 * Muestra todos los reportes activos sobre un mapa Leaflet con filtros
 * por estado de incidencia. A diferencia del mapa ciudadano, el admin
 * puede ver reportes en todos los estados (pendiente, asignado, en_curso, completado).
 *
 * Optimizacion de calles:
 *   Las direcciones se cargan lazy al abrir cada popup — no al renderizar
 *   los marcadores. El resultado se guarda en callesCache (por clave lat,lon)
 *   para no repetir la llamada si el mismo popup se abre nuevamente.
 *
 * Diferencias con el mapa ciudadano (CityMap):
 *   - Sin modal de reporte — el admin no crea reportes desde aqui
 *   - Sin ClusterSheet — los popups muestran el detalle inline
 *   - Filtros por estado visibles sobre el mapa
 *   - Tile layer fijo en modo claro (jawg-streets)
 *
 * Usado por: app/admin/components/AdminDashboard.tsx
 * Depende de: Leaflet, leaflet.markercluster, getCalle, getRelativeTime,
 *             GET /api/reports, NEXT_PUBLIC_JAWG_TOKEN
 */

import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
// @ts-ignore
import 'leaflet/dist/leaflet.css'
// @ts-ignore
import 'leaflet.markercluster'
// @ts-ignore
import 'leaflet.markercluster/dist/MarkerCluster.css'
// @ts-ignore
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'
import { getCalle } from '../../lib/utils/geo'
import { getRelativeTime } from '../../lib/utils/mapHelpers'

// Color del marcador segun estado de la incidencia
const getColor = (estado: string) => {
  switch (estado) {
    case 'pendiente':  return '#ef4444'
    case 'asignado':   return '#3b82f6'
    case 'en_curso':   return '#f97316'
    case 'completado': return '#22c55e'
    default:           return '#94a3b8'
  }
}

const ESTADO_LABELS: Record<string, string> = {
  todos:      'Todos',
  pendiente:  'Sin asignar',
  asignado:   'Asignado',
  en_curso:   'En curso',
  completado: 'Completado'
}

/**
 * Construye el HTML del popup de un reporte para el mapa admin.
 * El elemento con id="calle-{id}" se actualiza dinamicamente
 * cuando el popup se abre y la geocodificacion termina.
 *
 * @param r          - Datos del reporte
 * @param color      - Color hexadecimal del estado de la incidencia
 * @param estadoLabel - Etiqueta legible del estado
 * @param calle      - Direccion inicial (puede ser placeholder si aun no cargo)
 */
const buildPopup = (r: any, color: string, estadoLabel: string, calle: string) => `
  <div style="width:260px;font-family:system-ui,sans-serif;border-radius:12px;overflow:hidden">
    <div style="position:relative">
      <img src="${r.foto_url}" style="width:100%;height:130px;object-fit:cover;display:block"/>
      <div style="position:absolute;top:8px;left:8px">
        <span style="background:${color};color:white;font-size:10px;font-weight:700;padding:3px 10px;border-radius:20px">
          ${estadoLabel}
        </span>
      </div>
      <div style="position:absolute;bottom:0;left:0;right:0;background:linear-gradient(to top,rgba(0,0,0,0.6),transparent);padding:8px 10px 6px">
        <span style="color:white;font-size:10px">${getRelativeTime(r.creado_en)}</span>
      </div>
    </div>
    <div style="padding:12px;background:white">
      <p id="calle-${r.id}" style="font-size:13px;color:#1e293b;margin:0 0 6px;font-weight:600">📍 ${calle}</p>
      <p style="font-size:12px;color:#475569;margin:0 0 10px;line-height:1.5">${r.descripcion}</p>
      <div style="border-top:1px solid #f1f5f9;padding-top:8px">
        ${r.resumen_ia ? `
          <div style="background:#eff6ff;border-radius:8px;padding:6px 8px;margin-bottom:8px">
            <p style="font-size:10px;font-weight:700;color:#3b82f6;margin:0 0 2px;text-transform:uppercase">Resumen tecnico</p>
            <p style="font-size:11px;color:#1e40af;margin:0;line-height:1.4">${r.resumen_ia}</p>
          </div>
        ` : ''}
        <div style="display:flex;justify-content:flex-end">
          <a href="https://www.google.com/maps?q=${r.latitud},${r.longitud}" target="_blank"
             style="font-size:11px;color:#3b82f6;font-weight:600;text-decoration:none">
            Ver en Maps
          </a>
        </div>
      </div>
    </div>
  </div>
`

export default function AdminMap() {
  const mapRef          = useRef<L.Map | null>(null)
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const clusterRef      = useRef<any>(null)
  const [filtroEstado, setFiltroEstado] = useState('todos')
  const [reportes, setReportes] = useState<any[]>([])
  // Cache de calles por clave "lat,lon" — se puebla al abrir cada popup
  const callesCache = useRef<Record<string, string>>({})

  /**
   * Inicializa el mapa Leaflet al montar el componente.
   * Limites geograficos restringidos a Talca.
   * La funcion de limpieza destruye el mapa al desmontar.
   */
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return
    const map = L.map(mapContainerRef.current, {
      minZoom: 12,
      maxBounds: L.latLngBounds(
        L.latLng(-35.52, -71.75), // esquina suroeste
        L.latLng(-35.35, -71.58)  // esquina noreste
      ),
      maxBoundsViscosity: 1.0,
      zoomControl: false
    }).setView([-35.4264, -71.6554], 13)

    L.control.zoom({ position: 'bottomright' }).addTo(map)
    L.tileLayer(
      `https://tile.jawg.io/jawg-streets/{z}/{x}/{y}{r}.png?access-token=${process.env.NEXT_PUBLIC_JAWG_TOKEN}`,
      { attribution: '<a href="https://jawg.io">Jawg Maps</a>' }
    ).addTo(map)

    mapRef.current = map
    return () => { map.remove(); mapRef.current = null }
  }, [])

  /**
   * Carga los reportes sin esperar las calles — los marcadores aparecen
   * inmediatamente y las direcciones se cargan al abrir cada popup.
   */
  useEffect(() => {
    fetch('/api/reports')
      .then(r => r.json())
      .then(data => { if (data.reportes) setReportes(data.reportes) })
  }, [])

  /**
   * Recrea los marcadores cada vez que cambian los reportes o el filtro.
   * Elimina el cluster anterior y crea uno nuevo con los reportes filtrados.
   */
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (clusterRef.current) map.removeLayer(clusterRef.current)

    const cluster = (L as any).markerClusterGroup({
      maxClusterRadius: 40,
      iconCreateFunction: (c: any) => L.divIcon({
        html: `<div style="background:#1e293b;color:white;border-radius:50%;width:32px;height:32px;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:13px;border:2px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3)">${c.getChildCount()}</div>`,
        className: '',
        iconSize: [32, 32]
      })
    })

    // Filtrar por estado — 'todos' muestra todos sin filtrar
    const filtrados = filtroEstado === 'todos'
      ? reportes
      : reportes.filter(r => (r.incidencia?.estado ?? r.estado) === filtroEstado)

    filtrados.forEach((r: any) => {
      const estadoReal  = r.incidencia?.estado ?? r.estado
      const color       = getColor(estadoReal)
      const estadoLabel = ESTADO_LABELS[estadoReal] ?? estadoReal
      // Clave de cache por coordenadas — dos reportes en el mismo punto comparten la calle
      const key = `${r.latitud},${r.longitud}`

      // Mostrar calle del cache o placeholder mientras carga
      const calleInicial = callesCache.current[key] ?? 'Cargando direccion...'
      const marker = L.circleMarker(
        [parseFloat(r.latitud), parseFloat(r.longitud)],
        { radius: 9, fillColor: color, color: '#fff', weight: 2.5, opacity: 1, fillOpacity: 0.95 }
      )

      const popup = L.popup({ maxWidth: 280 }).setContent(
        buildPopup(r, color, estadoLabel, calleInicial)
      )
      marker.bindPopup(popup)

      /**
       * Al abrir el popup, cargar la calle via geocodificacion inversa.
       * Si ya esta en cache, actualizar el DOM sin hacer una nueva request.
       * El id="calle-{r.id}" en el HTML del popup permite actualizarlo directamente.
       */
      marker.on('popupopen', async () => {
        if (callesCache.current[key]) {
          const el = document.getElementById(`calle-${r.id}`)
          if (el) el.textContent = `📍 ${callesCache.current[key]}`
          return
        }
        const calle = await getCalle(parseFloat(r.latitud), parseFloat(r.longitud))
        callesCache.current[key] = calle
        const el = document.getElementById(`calle-${r.id}`)
        if (el) el.textContent = `📍 ${calle}`
      })

      cluster.addLayer(marker)
    })

    map.addLayer(cluster)
    clusterRef.current = cluster
  }, [reportes, filtroEstado])

  return (
    <div className="relative w-full h-full">
      {/* Filtros de estado superpuestos sobre el mapa */}
      <div className="absolute top-3 left-3 z-[1000] flex gap-1.5 flex-wrap">
        {Object.keys(ESTADO_LABELS).map(f => (
          <button key={f} onClick={() => setFiltroEstado(f)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shadow-md ${
              filtroEstado === f
                ? 'bg-slate-900 text-white'
                : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
            }`}
          >
            {ESTADO_LABELS[f]}
          </button>
        ))}
      </div>

      {/* Contenedor del mapa — Leaflet se monta en este div */}
      <div ref={mapContainerRef} className="w-full h-full" />
    </div>
  )
}