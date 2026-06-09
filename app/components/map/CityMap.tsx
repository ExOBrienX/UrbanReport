'use client'

/**
 * CityMap.tsx — Componente principal del mapa de incidencias ciudadano.
 *
 * Orquesta todos los elementos visuales del mapa: inicializa la instancia
 * de Leaflet, coordina los subcomponentes (controles, modal de reporte,
 * sheet de cluster) y delega la lógica de datos al hook useCityMap.
 *
 * Responsabilidades:
 *   - Crear y destruir la instancia del mapa Leaflet
 *   - Pasar la instancia al hook useCityMap para que gestione los marcadores
 *   - Abrir/cerrar el modal de reporte y el sheet de cluster
 *   - Sincronizar el tema (claro/oscuro) con el Header padre
 *
 * Flujo de datos:
 *   CityMap → useCityMap (marcadores y polling)
 *   CityMap → MapControls (botones de zoom, reporte y tema)
 *   CityMap → ReportModal (formulario de reporte ciudadano)
 *   CityMap → ClusterSheet (detalle de reportes agrupados)
 *
 * Usado por: app/page.tsx
 * Depende de: Leaflet, useCityMap, ReportModal, ClusterSheet, MapControls
 */

import { useCallback, useEffect, useState } from 'react'
import L from 'leaflet'
// @ts-ignore
import 'leaflet.markercluster'
// @ts-ignore
import 'leaflet.markercluster/dist/MarkerCluster.css'
// @ts-ignore
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'
// @ts-ignore
import 'leaflet/dist/leaflet.css'
import ReportModal from '../ui/Ciudadano/ReportModal'
import ClusterSheet from './ClusterSheet'
import MapControls from './MapControls'
import { useCityMap, ReporteConCalle } from '../../lib/hooks/useCityMap'

interface CityMapProps {
  onThemeChange?: (isDark: boolean) => void // notifica al padre cuando cambia el tema del mapa
}

export default function CityMap({ onThemeChange }: CityMapProps) {
  const [map, setMap] = useState<L.Map | null>(null)
  const [isReportModalOpen, setIsReportModalOpen] = useState(false)
  const [clusterReportes, setClusterReportes] = useState<ReporteConCalle[]>([])
  const [isClusterSheetOpen, setIsClusterSheetOpen] = useState(false)

  /**
   * Callback que recibe los reportes del cluster al hacer clic.
   * Lo pasa al hook useCityMap para que lo llame cuando el usuario abre un cluster.
   */
  const onClusterOpen = (reportes: ReporteConCalle[]) => {
    setClusterReportes(reportes)
    setIsClusterSheetOpen(true)
  }

  // useCallback evita que la función se recree en cada render
  const onReportClick = useCallback(() => {
    setIsReportModalOpen(true)
  }, [])

  // El hook gestiona todo: marcadores, clustering, polling y geocodificación
  const { removeNumberedMarkers, refreshReportes, restartPolling } = useCityMap({
    map,
    onClusterOpen,
  })

  /**
   * Inicializa el mapa Leaflet al montar el componente.
   * Limites geográficos restringidos a Talca para evitar que el usuario
   * navegue fuera del área de cobertura del sistema municipal.
   * La función de limpieza destruye el mapa al desmontar.
   */
  useEffect(() => {
    // Límites del mapa restringidos al área urbana de Talca
    const TALCA_BOUNDS = L.latLngBounds(
      L.latLng(-35.52, -71.75), // esquina suroeste
      L.latLng(-35.35, -71.58)  // esquina noreste
    )

    const mapInstance = L.map('map', {
      minZoom: 13,              // no permitir zoom out más allá de la ciudad
      maxBounds: TALCA_BOUNDS,  // bloquear el paneo fuera de Talca
      maxBoundsViscosity: 1.0   // resistencia máxima al arrastrar fuera de los límites
    }).setView([-35.4264, -71.6554], 13) // centro de Talca, zoom inicial

    setMap(mapInstance)

    return () => {
      mapInstance.remove() // limpiar instancia Leaflet al desmontar
    }
  }, [])

  /**
   * Al cerrar el modal de reporte, forzar recarga de marcadores
   * para reflejar el nuevo reporte en el mapa inmediatamente.
   */
  const handleModalClose = () => {
    setIsReportModalOpen(false)
    refreshReportes()
  }

  /**
   * Al cerrar el sheet de cluster:
   *   1. Eliminar los marcadores numerados del mapa
   *   2. Cerrar el sheet y limpiar los reportes en memoria
   *   3. Recargar los marcadores del mapa (puede haber cambios de estado)
   *   4. Reiniciar el polling que fue pausado al abrir el cluster
   */
  const handleCloseSheet = () => {
    removeNumberedMarkers()
    setIsClusterSheetOpen(false)
    setClusterReportes([])
    refreshReportes()
    restartPolling()
  }

  return (
    <>
      {/* Contenedor del mapa — Leaflet se monta en este div por id */}
      <div id="map" style={{ width: '100%', height: 'calc(100vh - 4rem)' }} />

      {/* Controles del mapa — solo se renderizan cuando el mapa está listo */}
      {map && (
        <MapControls
          map={map}
          onReportClick={onReportClick}
          onThemeChange={onThemeChange}
        />
      )}

      {/* Modal de creación de reporte ciudadano */}
      <ReportModal isOpen={isReportModalOpen} onClose={handleModalClose} />

      {/* Sheet de detalle de reportes al abrir un cluster */}
      <ClusterSheet
        isOpen={isClusterSheetOpen}
        reportes={clusterReportes}
        onClose={handleCloseSheet}
      />
    </>
  )
}