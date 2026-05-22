'use client'

import { getColor, getEstadoLabel, getRelativeTime } from '../../lib/utils/mapHelpers'

interface Reporte {
  id: number
  foto_url: string
  estado: string
  descripcion: string
  calle?: string
  creado_en: string
  incidencia?: {
    estado: string
  } | null
}

interface ClusterSheetProps {
  isOpen: boolean
  reportes: Reporte[]
  onClose: () => void
}

export default function ClusterSheet({ isOpen, reportes, onClose }: ClusterSheetProps) {
  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-end"
      onClick={onClose}
    >
      <div
        className="w-full max-h-[70vh] rounded-t-3xl bg-white overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 flex-shrink-0">
          <h2 className="text-base font-semibold text-slate-900">
            {reportes.length} incidencias en este sector
          </h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-700 text-xl">
            ✕
          </button>
        </div>

        {/* Lista con scroll */}
        <div className="overflow-y-auto flex-1 divide-y divide-slate-100">
          {reportes.map((reporte, index) => {
            const estadoReal = reporte.incidencia?.estado ?? reporte.estado
            const color = getColor(estadoReal)
            const label = getEstadoLabel(estadoReal)

            return (
              <div key={reporte.id ?? index} className="flex gap-3 p-4 items-start">
                {/* Número */}
                <div
                  className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold mt-1"
                  style={{ background: color }}
                >
                  {index + 1}
                </div>

                {/* Foto */}
                <img
                  src={reporte.foto_url}
                  alt="Foto del reporte"
                  className="w-20 h-20 rounded-lg object-cover flex-shrink-0 bg-slate-100"
                />

                {/* Datos */}
                <div className="flex flex-col gap-1 min-w-0 flex-1">
                  <span
                    className="text-xs font-semibold px-2 py-0.5 rounded-full w-fit"
                    style={{
                      background: color + '22',
                      color: color
                    }}
                  >
                    {label}
                  </span>
                  <p className="text-xs text-slate-500 font-medium">
                    📍 {reporte.calle ?? 'Dirección no disponible'}
                  </p>
                  <p className="text-sm text-slate-700 line-clamp-2">
                    {reporte.descripcion}
                  </p>
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