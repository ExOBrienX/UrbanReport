/**
 * useCityMap.ts — Hook personalizado para gestionar el mapa de incidencias.
 * 
 * ¿Qué es un hook personalizado?
 * Es una función de React que empieza con "use" y encapsula lógica reutilizable.
 * Permite separar la lógica del mapa del componente visual CityMap.tsx.
 *
 * Responsabilidades:
 *   - Cargar reportes desde la API y pintarlos en el mapa como burbujas
 *   - Agrupar reportes cercanos en clusters
 *   - Manejar el polling (actualización automática cada 30 segundos)
 *   - Mostrar marcadores numerados al abrir un cluster
 *
 * Usado por: app/components/map/CityMap.tsx
 * Depende de: Leaflet, leaflet.markercluster, mapHelpers, geo
 */

'use client'

import { useCallback, useEffect, useRef } from 'react'
import L from 'leaflet'
import { getColor, getEstadoLabel, getRelativeTime } from '../utils/mapHelpers'
import { getCalle } from '../utils/geo'

// Estructura de un reporte recibido desde GET /api/reports
export interface Reporte {
  id: number
  latitud: string   // string porque Prisma retorna Decimal como string
  longitud: string
  estado: string    // estado del reporte (pendiente, asignado, etc.)
  descripcion: string
  foto_url: string
  creado_en: string
  incidencia?: {
    // Estado real del trabajo en terreno — se usa para el color de la burbuja
    // porque refleja el avance real (en_curso, completado) no solo la validación
    estado: string
  } | null
}

// Extiende Reporte agregando la dirección calculada por geocodificación inversa
export interface ReporteConCalle extends Reporte {
  calle: string // nombre de la calle obtenido desde OpenStreetMap Nominatim
}

// Props que recibe el hook desde CityMap.tsx
interface UseCityMapOptions {
  map: L.Map | null                                    // instancia del mapa Leaflet
  onClusterOpen: (reportes: ReporteConCalle[]) => void // callback al abrir un cluster
}

// Lo que expone el hook hacia afuera (CityMap.tsx)
interface UseCityMapResult {
  refreshReportes: () => void       // forzar recarga de reportes desde la API
  removeNumberedMarkers: () => void // eliminar marcadores numerados del mapa
  restartPolling: () => void        // reiniciar el intervalo de actualización
}

export function useCityMap({ map, onClusterOpen }: UseCityMapOptions): UseCityMapResult {

  // useRef permite guardar valores que persisten entre renders sin causar re-renders
  const markersRef = useRef<L.CircleMarker[]>([])       // burbujas individuales en el mapa
  const clusterGroupRef = useRef<any>(null)             // grupo de clusters de Leaflet
  const numberedMarkersRef = useRef<L.Marker[]>([])     // marcadores numerados al abrir cluster
  const isProcessingClusterRef = useRef(false)          // flag para evitar doble procesamiento
  const intervalRef = useRef<NodeJS.Timeout | null>(null) // referencia al intervalo de polling

  /**
   * Elimina los marcadores numerados del mapa (los que aparecen al abrir un cluster).
   * useCallback memoriza la función para evitar que se recree en cada render.
   */
  const removeNumberedMarkers = useCallback(() => {
    if (!map) return
    numberedMarkersRef.current.forEach((marker) => {
      try {
        map.removeLayer(marker)
      } catch {
        // El marker puede haber sido eliminado previamente — ignorar el error
      }
    })
    numberedMarkersRef.current = [] // limpiar el array de referencias
  }, [map])

  /**
   * Muestra marcadores numerados (1, 2, 3...) sobre cada reporte de un cluster abierto.
   * Cada número tiene el color del estado de la incidencia correspondiente.
   *
   * @param reportes - Lista de reportes del cluster con su dirección calculada
   */
  const showNumberedMarkers = useCallback(
    (reportes: ReporteConCalle[]) => {
      if (!map) return
      removeNumberedMarkers() // limpiar marcadores anteriores antes de crear nuevos

      reportes.forEach((reporte, index) => {
        // Usar el estado de la incidencia si existe, sino el del reporte
        const color = getColor(reporte.incidencia?.estado ?? reporte.estado)

        // Crear un ícono HTML personalizado con el número y color del estado
        const icon = L.divIcon({
          html: `<div style="
            background:${color};color:white;border-radius:50%;
            width:32px;height:32px;display:flex;align-items:center;
            justify-content:center;font-weight:bold;font-size:13px;
            border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.4)
          ">${index + 1}</div>`,
          className: '',
          iconSize: [32, 32],
          iconAnchor: [16, 16], // punto de anclaje en el centro del ícono
        })

        const marker = L.marker(
          [parseFloat(reporte.latitud), parseFloat(reporte.longitud)],
          { icon }
        ).addTo(map)

        numberedMarkersRef.current.push(marker) // guardar referencia para poder eliminarlo después
      })
    },
    [map, removeNumberedMarkers]
  )

  /**
   * Detiene el polling (actualización automática cada 30 segundos).
   * Se llama al abrir un cluster para no interrumpir la vista de detalle.
   */
  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current) // cancelar el intervalo activo
      intervalRef.current = null
    }
  }, [])

  /**
   * Carga los reportes desde la API y los pinta en el mapa como burbujas.
   * Es la función principal del hook — se ejecuta al iniciar y cada 30 segundos.
   */
  const loadReportes = useCallback(async () => {
    if (!map) return

    // Limpiar marcadores numerados y cluster anterior antes de recargar
    removeNumberedMarkers()
    if (clusterGroupRef.current) {
      try {
        map.removeLayer(clusterGroupRef.current)
      } catch {
        // El clusterGroup puede haber sido eliminado — ignorar
      }
      clusterGroupRef.current = null
    }
    markersRef.current = []

    try {
      // Obtener reportes activos desde el backend
      const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/reports`)
      const data = await res.json()

      if (!data.reportes || !map) return

      // Crear grupo de clusters — agrupa burbujas cercanas automáticamente
      const clusterGroup = (L as any).markerClusterGroup({
        maxClusterRadius: 40,         // radio en píxeles para agrupar marcadores
        spiderfyOnMaxZoom: false,     // no dispersar en araña al máximo zoom
        zoomToBoundsOnClick: true,    // hacer zoom al área del cluster al hacer clic
        // Función que define la apariencia del ícono de cluster
        iconCreateFunction: (cluster: any) => {
          const count = cluster.getChildCount() // cantidad de reportes agrupados
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

      // Evento al hacer clic en un cluster
      clusterGroup.on('clusterclick', (e: any) => {
        // Evitar procesamiento doble si ya se está procesando un click
        if (isProcessingClusterRef.current) return
        isProcessingClusterRef.current = true

        const cluster = e.layer
        const markers = cluster.getAllChildMarkers() // obtener todos los marcadores del cluster

        // Solo expandir clusters pequeños (<=7) para no saturar la pantalla
        if (markers.length <= 7) {
          // Extraer los datos del reporte guardados en cada marcador
          const reportesDelCluster = markers.map((marker: any) => marker.options.reporteData)
          map.removeLayer(cluster) // ocultar el cluster mientras se muestra el detalle

          // Obtener la dirección de cada reporte de forma asíncrona (geocodificación inversa)
          Promise.all(
            reportesDelCluster.map(async (reporte: Reporte) => ({
              ...reporte,
              calle: await getCalle(parseFloat(reporte.latitud), parseFloat(reporte.longitud)),
            }))
          )
            .then((reportesConCalle) => {
              stopPolling()               // pausar polling mientras se ve el detalle
              onClusterOpen(reportesConCalle) // abrir el ClusterSheet con los datos
              showNumberedMarkers(reportesConCalle) // mostrar números sobre el mapa
              isProcessingClusterRef.current = false
            })
            .catch(() => {
              isProcessingClusterRef.current = false
            })
        } else {
          isProcessingClusterRef.current = false
        }

        L.DomEvent.stopPropagation(e) // evitar que el evento se propague al mapa
      })

      // Crear una burbuja (circleMarker) por cada reporte activo
      data.reportes.forEach((reporte: Reporte) => {
        // El color refleja el estado de la INCIDENCIA (trabajo real) no del reporte
        const color = getColor(reporte.incidencia?.estado ?? reporte.estado)

        const marker = L.circleMarker(
          [parseFloat(reporte.latitud), parseFloat(reporte.longitud)],
          {
            radius: 10,       // tamaño de la burbuja en píxeles
            fillColor: color,
            color: '#ffffff', // borde blanco
            weight: 2,
            opacity: 1,
            fillOpacity: 0.9,
            // @ts-ignore — Leaflet no tipifica opciones personalizadas, pero funciona
            reporteData: reporte, // guardar datos del reporte en el marcador para accederlos al hacer clic
          }
        ).on('click', async () => {
          const currentMap = map
          if (!currentMap) return

          // Animar el mapa hacia el reporte al hacer clic
          currentMap.flyTo(
            [parseFloat(reporte.latitud), parseFloat(reporte.longitud)],
            18,           // nivel de zoom al que se acerca
            { duration: 1 } // duración de la animación en segundos
          )

          // Obtener nombre de la calle usando geocodificación inversa (OpenStreetMap)
          const calle = await getCalle(parseFloat(reporte.latitud), parseFloat(reporte.longitud))

          // Mostrar popup con la información del reporte
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

        clusterGroup.addLayer(marker) // agregar el marcador al grupo de clusters
        markersRef.current.push(marker)
      })

      map.addLayer(clusterGroup) // agregar el grupo completo al mapa
      clusterGroupRef.current = clusterGroup // guardar referencia para limpieza posterior

    } catch (error) {
      console.error('Error cargando reportes:', error)
    }
  }, [map, onClusterOpen, showNumberedMarkers, stopPolling, removeNumberedMarkers])

  /**
   * Reinicia el polling — cancela el intervalo actual y crea uno nuevo.
   * Se llama al cerrar el ClusterSheet para reanudar las actualizaciones.
   */
  const restartPolling = useCallback(() => {
    stopPolling()
    if (map) {
      // Actualizar los reportes automáticamente cada 30 segundos
      intervalRef.current = setInterval(loadReportes, 30000)
    }
  }, [loadReportes, map, stopPolling])

  /**
   * Efecto principal — se ejecuta cuando el mapa está disponible.
   * Carga los reportes iniciales e inicia el polling.
   * La función de limpieza (return) se ejecuta al desmontar el componente.
   */
  useEffect(() => {
    if (!map) return
    loadReportes()    // carga inicial de reportes
    restartPolling()  // iniciar actualización automática

    // Limpieza al desmontar: detener polling y eliminar capas del mapa
    return () => {
      stopPolling()
      removeNumberedMarkers()
      if (clusterGroupRef.current) {
        try {
          map.removeLayer(clusterGroupRef.current)
        } catch {
          // Ignorar si el mapa ya fue destruido
        }
        clusterGroupRef.current = null
      }
    }
  }, [map, loadReportes, restartPolling, removeNumberedMarkers, stopPolling])

  // Exponer solo las funciones que necesita CityMap.tsx
  return {
    refreshReportes: loadReportes,
    removeNumberedMarkers,
    restartPolling,
  }
}