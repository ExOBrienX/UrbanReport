'use client'

/**
 * ClusterSheet.tsx — Panel inferior de detalle de reportes agrupados.
 *
 * Se abre desde el mapa cuando el ciudadano toca un cluster de marcadores
 * (grupo de incidencias cercanas). Muestra la lista de reportes del cluster
 * con foto, estado, dirección y descripción de cada uno.
 *
 * El número de cada reporte coincide con el marcador numerado que se pinta
 * sobre el mapa al abrir el sheet, permitiendo al ciudadano identificar
 * visualmente qué número corresponde a qué incidencia en el mapa.
 *
 * Diseño:
 *   - Sheet que sube desde la parte inferior (patrón mobile-first)
 *   - Clic fuera del sheet lo cierra (overlay transparente)
 *   - Lista con scroll interno para soportar clusters grandes
 *   - Color del badge y número sincronizado con el estado de la incidencia
 *
 * Usado por: app/components/map/CityMap.tsx
 * Depende de: mapHelpers (getColor, getEstadoLabel, getRelativeTime)
 */

import { getColor, getEstadoLabel, getRelativeTime } from '../../lib/utils/mapHelpers'

interface Reporte {
  id: number
  foto_url: string
  estado: string
  descripcion: string
  calle?: string    // dirección calculada por geocodificación inversa — puede ser undefined si falló
  creado_en: string
  incidencia?: {
    estado: string  // estado real del trabajo — tiene prioridad sobre el estado del reporte
  } | null
}

interface ClusterSheetProps {
  isOpen: boolean        // controla visibilidad del sheet
  reportes: Reporte[]    // lista de reportes del cluster abierto
  onClose: () => void    // callback al cerrar — elimina marcadores numerados y reinicia polling
}

export default function ClusterSheet({ isOpen, reportes, onClose }: ClusterSheetProps) {
  if (!isOpen) return null

  return (
    // Overlay — clic fuera del sheet llama a onClose
    <div
      className="fixed inset-0 z-[9999] flex items-end"
      onClick={onClose}
    >
      <div
        className="w-full max-h-[70vh] rounded-t-3xl bg-white overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()} // evitar que el clic en el sheet cierre el overlay
      >
        {/* Header con contador de incidencias */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 flex-shrink-0">
          <h2 className="text-base font-semibold text-slate-900">
            {reportes.length} incidencias en este sector
          </h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-700 text-xl">
            ✕
          </button>
        </div>

        {/* Lista scrolleable de reportes */}
        <div className="overflow-y-auto flex-1 divide-y divide-slate-100">
          {reportes.map((reporte, index) => {
            // Usar el estado de la incidencia si existe — refleja el avance real del trabajo
            const estadoReal = reporte.incidencia?.estado ?? reporte.estado
            const color = getColor(estadoReal)
            const label = getEstadoLabel(estadoReal)

            return (
              <div key={reporte.id ?? index} className="flex gap-3 p-4 items-start">

                {/* Número correlativo — coincide con el marcador sobre el mapa */}
                <div
                  className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold mt-1"
                  style={{ background: color }}
                >
                  {index + 1}
                </div>

                {/* Foto del reporte */}
                <img
                  src={reporte.foto_url}
                  alt="Foto del reporte"
                  className="w-20 h-20 rounded-lg object-cover flex-shrink-0 bg-slate-100"
                />

                {/* Información del reporte */}
                <div className="flex flex-col gap-1 min-w-0 flex-1">
                  {/* Badge de estado con color semitransparente */}
                  <span
                    className="text-xs font-semibold px-2 py-0.5 rounded-full w-fit"
                    style={{
                      background: color + '22', // opacidad 13% del color del estado
                      color: color
                    }}
                  >
                    {label}
                  </span>

                  {/* Dirección — puede mostrar fallback si la geocodificación falló */}
                  <p className="text-xs text-slate-500 font-medium">
                    📍 {reporte.calle ?? 'Dirección no disponible'}
                  </p>

                  {/* Descripción del ciudadano — truncada a 2 líneas */}
                  <p className="text-sm text-slate-700 line-clamp-2">
                    {reporte.descripcion}
                  </p>

                  {/* Tiempo relativo desde el reporte */}
                  <p className="text-xs text-slate-400">
                    {getRelativeTime(reporte.creado_en)}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}