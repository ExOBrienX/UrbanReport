'use client'

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
  onThemeChange?: (isDark: boolean) => void
}

export default function CityMap({ onThemeChange }: CityMapProps) {
  const [map, setMap] = useState<L.Map | null>(null)
  const [isReportModalOpen, setIsReportModalOpen] = useState(false)
  const [clusterReportes, setClusterReportes] = useState<ReporteConCalle[]>([])
  const [isClusterSheetOpen, setIsClusterSheetOpen] = useState(false)

  const onClusterOpen = (reportes: ReporteConCalle[]) => {
    setClusterReportes(reportes)
    setIsClusterSheetOpen(true)
  }

  const onReportClick = useCallback(() => {
    setIsReportModalOpen(true)
  }, [])

  const { removeNumberedMarkers, refreshReportes, restartPolling } = useCityMap({
    map,
    onClusterOpen,
  })

  useEffect(() => {
    const TALCA_BOUNDS = L.latLngBounds(
  L.latLng(-35.52, -71.75), // suroeste
  L.latLng(-35.35, -71.58)  // noreste
)

const mapInstance = L.map('map', {
  minZoom: 13,
  maxBounds: TALCA_BOUNDS,
  maxBoundsViscosity: 1.0
}).setView([-35.4264, -71.6554], 13)

    setMap(mapInstance)

    return () => {
      mapInstance.remove()
    }
  }, [])

  const handleModalClose = () => {
    setIsReportModalOpen(false)
    refreshReportes()
  }

  const handleCloseSheet = () => {
    removeNumberedMarkers()
    setIsClusterSheetOpen(false)
    setClusterReportes([])
    refreshReportes()
    restartPolling()
  }

  return (
    <>
      <div id="map" style={{ width: '100%', height: 'calc(100vh - 4rem)' }} />
      {map && <MapControls map={map} onReportClick={onReportClick} onThemeChange={onThemeChange} />}
      <ReportModal isOpen={isReportModalOpen} onClose={handleModalClose} />
      <ClusterSheet
        isOpen={isClusterSheetOpen}
        reportes={clusterReportes}
        onClose={handleCloseSheet}
      />
    </>
  )
}
