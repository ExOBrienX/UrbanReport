'use client'

/**
 * TareaDetalleSheet.tsx — Sheet de detalle completo de una tarea del tecnico.
 *
 * Se abre desde TecnicoPage al hacer clic en una TareaCard o en el banner
 * de tarea activa. Muestra toda la informacion de la incidencia y expone
 * los botones de accion disponibles segun el estado actual de la tarea.
 *
 * Transiciones de estado posibles (solo para tareas propias):
 *   asignada → Aceptar  → aceptada
 *   aceptada → Iniciar  → en_curso
 *   aceptada → Atraso   → atrasada
 *   en_curso → Atraso   → atrasada
 *   en_curso → Completar → completada (requiere foto de evidencia)
 *   atrasada → Completar → completada (requiere foto de evidencia)
 *
 * Validaciones de botones:
 *   - Completar: solo disponible en estado en_curso o atrasada
 *   - Atraso: solo disponible en estado aceptada o en_curso
 *   - Aceptar: visible para cualquier tecnico si la tarea esta en cola
 *   - Iniciar, Atraso, Completar: solo si esMia (tarea propia)
 *
 * Usado por: app/tecnico/page.tsx
 * Depende de: Tarea (importada de TareaCard)
 */

import { Tarea } from './Tareacard'

interface TareaDetalleSheetProps {
  tarea: Tarea
  tecnicoId: number
  onCerrar: () => void
  onAceptar: () => void
  onIniciar: () => void
  onAtraso: () => void
  onCompletar: () => void
  accionando: boolean
}

const ESTADO_CONFIG: Record<string, { label: string; color: string }> = {
  asignada:   { label: 'Disponible', color: 'bg-slate-100 text-slate-700' },
  aceptada:   { label: 'Aceptada',   color: 'bg-blue-100 text-blue-700' },
  en_curso:   { label: 'En curso',   color: 'bg-orange-100 text-orange-700' },
  atrasada:   { label: 'Con atraso', color: 'bg-red-100 text-red-700' },
  completada: { label: 'Completada', color: 'bg-green-100 text-green-700' },
}

const MOTIVO_LABELS: Record<string, string> = {
  materiales:  'Falta de materiales',
  complejidad: 'Complejidad mayor a la estimada',
  clima:       'Condiciones climaticas',
  otro:        'Otro motivo',
}

export default function TareaDetalleSheet({
  tarea, tecnicoId, onCerrar, onAceptar, onIniciar, onAtraso, onCompletar, accionando
}: TareaDetalleSheetProps) {
  const reporte = tarea.incidencia.reportes[0]
  const estado  = ESTADO_CONFIG[tarea.estado] ?? { label: tarea.estado, color: 'bg-slate-100 text-slate-700' }
  const esMia   = tarea.tecnico_id === tecnicoId
  const lat     = parseFloat(tarea.incidencia.latitud)
  const lon     = parseFloat(tarea.incidencia.longitud)

  const abrirRuta = () => {
    window.open(`https://www.google.com/maps?q=${lat},${lon}`, '_blank')
  }

  // Validaciones de disponibilidad de acciones segun estado actual
  // Atraso: solo cuando el trabajo ya esta iniciado (en_curso)
  // Completar: solo cuando esta en_curso o atrasada — no se puede completar sin iniciar
  const puedeReportarAtraso = tarea.estado === 'en_curso'
  const puedeCompletar      = ['en_curso', 'atrasada'].includes(tarea.estado)

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/50" onClick={onCerrar}>
      <div
        className="w-full max-h-[90vh] bg-white rounded-t-3xl overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex-shrink-0 pt-3 pb-1 flex justify-center">
          <div className="w-10 h-1 bg-slate-200 rounded-full" />
        </div>

        <div className="flex-shrink-0 flex items-center justify-between px-5 pb-3 border-b border-slate-100">
          <span className={`text-xs font-semibold px-3 py-1 rounded-full ${estado.color}`}>
            {estado.label}
          </span>
          <button onClick={onCerrar} className="text-slate-400 hover:text-slate-600 text-xl px-1">
            X
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-4">

          {/* Foto del reporte — object-contain para ver la imagen completa sin cortar */}
          {reporte?.foto_url && (
            <div className="rounded-2xl overflow-hidden bg-slate-100 flex items-center justify-center" style={{ maxHeight: '180px' }}>
              <img
                src={reporte.foto_url}
                alt="Foto del reporte"
                className="w-full object-contain"
                style={{ maxHeight: '180px' }}
              />
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">
                {tarea.incidencia.categoria.nombre}
              </h3>
              <div className="text-right">
                <p className="text-2xl font-bold text-slate-900">
                  {Math.round(tarea.incidencia.puntaje_prioridad)}
                </p>
                <p className="text-xs text-slate-400">prioridad</p>
              </div>
            </div>
            <p className="text-xs text-slate-500">
              📍 {lat.toFixed(5)}, {lon.toFixed(5)}
            </p>
          </div>

          {reporte?.resumen_ia && (
            <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4">
              <p className="text-xs font-semibold text-slate-500 mb-1">Resumen tecnico</p>
              <p className="text-sm text-slate-700">{reporte.resumen_ia}</p>
            </div>
          )}

          {reporte?.descripcion && (
            <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4">
              <p className="text-xs font-semibold text-slate-500 mb-1">Descripcion del ciudadano</p>
              <p className="text-sm text-slate-700">{reporte.descripcion}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-slate-50 border border-slate-200 p-3 text-center">
              <p className="text-2xl font-bold text-slate-900">{tarea.incidencia.contador_reportes}</p>
              <p className="text-xs text-slate-500">Reportes ciudadanos</p>
            </div>
            <div className="rounded-2xl bg-slate-50 border border-slate-200 p-3 text-center">
              <p className="text-2xl font-bold text-slate-900">{tarea.incidencia.categoria.peligrosidad}</p>
              <p className="text-xs text-slate-500">Peligrosidad categoria</p>
            </div>
          </div>

          {tarea.estado === 'atrasada' && tarea.motivo_atraso && (
            <div className="rounded-2xl bg-red-50 border border-red-200 p-4">
              <p className="text-xs font-semibold text-red-600 mb-1">Motivo de atraso</p>
              <p className="text-sm text-red-700">
                {MOTIVO_LABELS[tarea.motivo_atraso] ?? tarea.motivo_atraso}
              </p>
            </div>
          )}

          <button
            onClick={abrirRuta}
            className="w-full rounded-2xl border border-slate-200 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 flex items-center justify-center gap-2"
          >
            Ver ruta en Google Maps
          </button>
        </div>

        {/* Acciones fijas — validadas por estado */}
        <div className="flex-shrink-0 p-4 border-t border-slate-100 space-y-2">

          {/* Aceptar — cola compartida, cualquier tecnico puede aceptar */}
          {tarea.estado === 'asignada' && (
            <button
              onClick={onAceptar}
              disabled={accionando}
              className="w-full rounded-2xl bg-slate-900 py-3.5 text-sm font-semibold text-white hover:bg-slate-700 disabled:bg-slate-400"
            >
              {accionando ? 'Aceptando...' : 'Aceptar tarea'}
            </button>
          )}

          {/* Iniciar — solo si fue aceptada por este tecnico */}
          {tarea.estado === 'aceptada' && esMia && (
            <button
              onClick={onIniciar}
              disabled={accionando}
              className="w-full rounded-2xl bg-orange-500 py-3.5 text-sm font-semibold text-white hover:bg-orange-600 disabled:bg-slate-400"
            >
              {accionando ? 'Iniciando...' : 'Iniciar trabajo'}
            </button>
          )}

          {/* Atraso y Completar — con validaciones de estado */}
          {esMia && (puedeReportarAtraso || puedeCompletar) && (
            <div className="flex gap-2">
              {/* Atraso: solo en aceptada o en_curso */}
              {puedeReportarAtraso && (
                <button
                  onClick={onAtraso}
                  disabled={accionando}
                  className="flex-1 rounded-2xl border border-slate-200 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Reportar atraso
                </button>
              )}
              {/* Completar: solo en en_curso o atrasada — requiere haber iniciado */}
              {puedeCompletar && (
                <button
                  onClick={onCompletar}
                  disabled={accionando}
                  className="flex-1 rounded-2xl bg-green-600 py-3 text-sm font-semibold text-white hover:bg-green-700 disabled:bg-slate-400"
                >
                  Completar
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}