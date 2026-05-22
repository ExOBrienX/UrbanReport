interface TareaCardProps {
  tarea: Tarea
  tecnicoId: number
  onVerDetalle: (tarea: Tarea) => void
  onAceptar: (tareaId: number) => void
  accionando: boolean
}

export interface Tarea {
  id: number
  estado: string
  motivo_atraso: string | null
  tecnico_id: number | null
  incidencia: {
    id: number
    puntaje_prioridad: number
    contador_reportes: number
    latitud: string
    longitud: string
    categoria: { nombre: string; peligrosidad: number }
    reportes: {
      foto_url: string
      descripcion: string
      resumen_ia: string | null
      creado_en: string
    }[]
  }
}

const CATEGORIA_ICONS: Record<string, string> = {
  'Pavimento': '🛣️',
  'Veredas': '🚶',
  'Areas Verdes': '🌳',
  'Senaletica': '🚦',
  'Residuos': '🗑️',
  'Mobiliario': '🪑',
}

const PRIORIDAD_CONFIG = (puntaje: number) => {
  if (puntaje >= 70) return { label: 'Alta prioridad', color: 'text-red-600 bg-red-50', dot: 'bg-red-500', border: 'border-l-red-500' }
  if (puntaje >= 40) return { label: 'Media prioridad', color: 'text-amber-600 bg-amber-50', dot: 'bg-amber-500', border: 'border-l-amber-500' }
  return { label: 'Baja prioridad', color: 'text-slate-500 bg-slate-100', dot: 'bg-slate-400', border: 'border-l-slate-300' }
}

export default function TareaCard({ tarea, tecnicoId, onVerDetalle, onAceptar, accionando }: TareaCardProps) {
  const reporte = tarea.incidencia.reportes[0]
  const puntaje = Math.round(tarea.incidencia.puntaje_prioridad)
  const prioridad = PRIORIDAD_CONFIG(puntaje)
  const icono = CATEGORIA_ICONS[tarea.incidencia.categoria.nombre] ?? '📍'
  const esMia = tarea.tecnico_id === tecnicoId

  return (
    <div
      className={`bg-white rounded-2xl border border-slate-200 border-l-4 ${prioridad.border} overflow-hidden active:scale-[0.98] transition-transform`}
      onClick={() => onVerDetalle(tarea)}
    >
      <div className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-lg">{icono}</span>
            <div>
              <p className="text-sm font-semibold text-slate-900">
                {tarea.incidencia.categoria.nombre}
              </p>
              {esMia && tarea.estado !== 'asignada' && (
                <p className="text-xs text-blue-600 font-medium">Tu tarea</p>
              )}
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-2xl font-bold text-slate-900">{puntaje}</p>
            <p className="text-xs text-slate-400">prioridad</p>
          </div>
        </div>

        {/* Resumen IA */}
        {reporte?.resumen_ia && (
          <p className="text-sm text-slate-600 line-clamp-2">{reporte.resumen_ia}</p>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className={`flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${prioridad.color}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${prioridad.dot}`} />
              {prioridad.label}
            </span>
            <span className="text-xs text-slate-400">
              {tarea.incidencia.contador_reportes} reporte{tarea.incidencia.contador_reportes > 1 ? 's' : ''}
            </span>
          </div>

          {/* Botón aceptar solo si está disponible */}
          {tarea.estado === 'asignada' && (
            <button
              onClick={(e) => { e.stopPropagation(); onAceptar(tarea.id) }}
              disabled={accionando}
              className="bg-slate-900 text-white text-xs font-semibold px-4 py-2 rounded-xl hover:bg-slate-700 disabled:bg-slate-400 transition-colors"
            >
              Aceptar
            </button>
          )}
        </div>
      </div>
    </div>
  )
}