'use client'

import { useCallback, useEffect, useRef } from 'react'
import L from 'leaflet'
import { getColor, getEstadoLabel, getRelativeTime } from '../utils/mapHelpers'
import { getCalle } from '../utils/geo'

export interface Reporte {
  id: number
  latitud: string
  longitud: string
  estado: string
  descripcion: string
  foto_url: string
  creado_en: string
  incidencia?: {           // ← agregar esto
    estado: string
  } | null
}

export interface ReporteConCalle extends Reporte {
  calle: string
}

interface UseCityMapOptions {
  map: L.Map | null
  onClusterOpen: (reportes: ReporteConCalle[]) => void
}

interface UseCityMapResult {
  refreshReportes: () => void
  removeNumberedMarkers: () => void
  restartPolling: () => void
}

export function useCityMap({ map, onClusterOpen }: UseCityMapOptions): UseCityMapResult {
  const markersRef = useRef<L.CircleMarker[]>([])
  const clusterGroupRef = useRef<any>(null)
  const numberedMarkersRef = useRef<L.Marker[]>([])
  const isProcessingClusterRef = useRef(false)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  const removeNumberedMarkers = useCallback(() => {
    if (!map) return
    numberedMarkersRef.current.forEach((marker) => {
      try {
        map.removeLayer(marker)
      } catch {
        // Ignorar fallas de eliminación si el marker ya no existe
      }
    })
    numberedMarkersRef.current = []
  }, [map])

  const showNumberedMarkers = useCallback(
    (reportes: ReporteConCalle[]) => {
      if (!map) return
      removeNumberedMarkers()

      reportes.forEach((reporte, index) => {
        const color = getColor(reporte.incidencia?.estado ?? reporte.estado)
        const icon = L.divIcon({
          html: `<div style="
            background:${color};color:white;border-radius:50%;
            width:32px;height:32px;display:flex;align-items:center;
            justify-content:center;font-weight:bold;font-size:13px;
            border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.4)
          ">${index + 1}</div>`,
          className: '',
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        })

        const marker = L.marker([parseFloat(reporte.latitud), parseFloat(reporte.longitud)], {
          icon,
        }).addTo(map)

        numberedMarkersRef.current.push(marker)
      })
    },
    [map, removeNumberedMarkers]
  )

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  const loadReportes = useCallback(async () => {
    if (!map) return
    removeNumberedMarkers()

    if (clusterGroupRef.current) {
      try {
        map.removeLayer(clusterGroupRef.current)
      } catch {
        // Ignorar si el clusterGroup ya se eliminó
      }
      clusterGroupRef.current = null
    }

    markersRef.current = []

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/reports`)
      const data = await res.json()

      if (!data.reportes || !map) return

      const clusterGroup = (L as any).markerClusterGroup({
        maxClusterRadius: 40,
        spiderfyOnMaxZoom: false,
        zoomToBoundsOnClick: true,
        iconCreateFunction: (cluster: any) => {
          const count = cluster.getChildCount()
          return L.divIcon({
            html: `<div style="
              background:#1e293b;color:white;border-radius:50%;
              width:36px;height:36px;display:flex;align-items:center;
              justify-content:center;font-weight:bold;font-size:14px;
              border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3)
            ">${count}</div>`,
            className: '',
            iconSize: [36, 36],
          })
        },
      })

      clusterGroup.on('clusterclick', (e: any) => {
        if (isProcessingClusterRef.current) return
        isProcessingClusterRef.current = true

        const cluster = e.layer
        const markers = cluster.getAllChildMarkers()

        if (markers.length <= 7) {
          const reportesDelCluster = markers.map((marker: any) => marker.options.reporteData)
          map.removeLayer(cluster)

          Promise.all(
            reportesDelCluster.map(async (reporte: Reporte) => ({
              ...reporte,
              calle: await getCalle(parseFloat(reporte.latitud), parseFloat(reporte.longitud)),
            }))
          )
            .then((reportesConCalle) => {
              stopPolling()
              onClusterOpen(reportesConCalle)
              showNumberedMarkers(reportesConCalle)
              isProcessingClusterRef.current = false
            })
            .catch(() => {
              isProcessingClusterRef.current = false
            })
        } else {
          isProcessingClusterRef.current = false
        }

        L.DomEvent.stopPropagation(e)
      })

      data.reportes.forEach((reporte: Reporte) => {
        const color = getColor(reporte.incidencia?.estado ?? reporte.estado)
        const marker = L.circleMarker([parseFloat(reporte.latitud), parseFloat(reporte.longitud)], {
          radius: 10,
          fillColor: color,
          color: '#ffffff',
          weight: 2,
          opacity: 1,
          fillOpacity: 0.9,
          // @ts-ignore
          reporteData: reporte,
        }).on('click', async () => {
          const currentMap = map
          if (!currentMap) return

          currentMap.flyTo([parseFloat(reporte.latitud), parseFloat(reporte.longitud)], 18, {
            duration: 1,
          })

          const calle = await getCalle(parseFloat(reporte.latitud), parseFloat(reporte.longitud))

          L.popup()
            .setLatLng([parseFloat(reporte.latitud), parseFloat(reporte.longitud)])
            .setContent(`
              <div style="min-width:220px;font-family:system-ui,sans-serif;">
                <img src="${reporte.foto_url}" 
                  style="width:100%;height:140px;object-fit:cover;border-radius:6px;margin-bottom:10px"
                  alt="Foto del reporte"
                />
                <div style="font-size:12px;">
                  <div style="margin-bottom:8px;">
                    <span style="
                      display:inline-block;background:${color};color:white;
                      padding:4px 10px;border-radius:4px;font-weight:bold;font-size:11px
                    ">${getEstadoLabel(reporte.incidencia?.estado ?? reporte.estado)}</span>
                  </div>
                  <p style="margin:6px 0;font-weight:600;color:#333;">📍 ${calle}</p>
                  <p style="margin:6px 0;color:#555;line-height:1.4;">${reporte.descripcion}</p>
                  <p style="margin:6px 0;color:#999;font-size:11px;">${getRelativeTime(reporte.creado_en)}</p>
                </div>
              </div>
            `)
            .openOn(currentMap)
        })

        clusterGroup.addLayer(marker)
        markersRef.current.push(marker)
      })

      map.addLayer(clusterGroup)
      clusterGroupRef.current = clusterGroup
    } catch (error) {
      console.error('Error cargando reportes:', error)
    }
  }, [map, onClusterOpen, showNumberedMarkers, stopPolling, removeNumberedMarkers])

  const restartPolling = useCallback(() => {
    stopPolling()
    if (map) {
      intervalRef.current = setInterval(loadReportes, 30000)
    }
  }, [loadReportes, map, stopPolling])

  useEffect(() => {
    if (!map) return
    loadReportes()
    restartPolling()

    return () => {
      stopPolling()
      removeNumberedMarkers()
      if (clusterGroupRef.current) {
        try {
          map.removeLayer(clusterGroupRef.current)
        } catch {
          // Ignorar
        }
        clusterGroupRef.current = null
      }
    }
  }, [map, loadReportes, restartPolling, removeNumberedMarkers, stopPolling])

  return {
    refreshReportes: loadReportes,
    removeNumberedMarkers,
    restartPolling,
  }
}
