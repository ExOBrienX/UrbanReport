'use client'

/**
 * ModalHistorialTareas.tsx — Modal de historial completo de tareas de un tecnico.
 *
 * Se abre desde GestionTecnicos al hacer clic en una fila de la tabla.
 * Muestra todas las tareas del tecnico con filtros por estado y periodo,
 * estadisticas rapidas y panel de detalle al seleccionar una tarea.
 *
 * Layout:
 *   - Panel izquierdo: estadisticas, filtros y tabla de tareas
 *   - Panel derecho: detalle de la tarea seleccionada con fotos expandibles,
 *     resumen IA, fechas, motivo de atraso o cancelacion
 *
 * Filtro "Con atraso" — incluye tareas que tuvieron motivo_atraso sin importar
 * su estado final (una tarea atrasada puede haber terminado como completada).
 *
 * Usado por: app/admin/components/GestionTecnicos.tsx
 * Depende de: GET /api/admin/tecnicos/[id]/tareas
 */

import { useEffect, useState } from 'react'

interface Reporte {
  foto_url: string
  descripcion: string
  resumen_ia: string | null
  confianza_ia: number | null
}

interface Tarea {
  id: number
  estado: string
  foto_evidencia_url: string | null // foto subida por el tecnico al completar
  creado_en: string
  completada_en: string | null
  motivo_atraso: string | null
  motivo_cancelacion: string | null
  incidencia: {
    id: number
    estado: string
    puntaje_prioridad: number
    contador_reportes: number
    latitud: string
    longitud: string
    categoria: { nombre: string }
    reportes: Reporte[] // reporte ciudadano con foto y resumen IA
  }
}

interface Tecnico {
  id: number
  nombre: string
  email: string
}

interface Props {
  tecnico: Tecnico
  onCerrar: () => void
}

// Colores de badge por estado de tarea
const ESTADO_COLORS: Record<string, string> = {
  asignada:   'bg-slate-100 text-slate-600',
  aceptada:   'bg-blue-100 text-blue-700',
  en_curso:   'bg-amber-100 text-amber-700',
  atrasada:   'bg-red-100 text-red-700',
  completada: 'bg-green-100 text-green-700',
  cancelada:  'bg-slate-100 text-slate-400',
}

const FILTROS_ESTADO  = ['todas', 'completada', 'con_atraso', 'cancelada', 'en_curso', 'asignada']
const FILTROS_PERIODO = ['todo', 'semana', 'mes']

const ESTADO_LABELS: Record<string, string> = {
  todas: 'Todas', completada: 'Completadas', con_atraso: 'Con atraso',
  cancelada: 'Canceladas', en_curso: 'En curso', asignada: 'Asignadas'
}

const PERIODO_LABELS: Record<string, string> = {
  todo: 'Todo el tiempo', semana: 'Esta semana', mes: 'Este mes'
}

/**
 * Componente de foto que se expande al hacer clic.
 * Muestra la imagen en tamano completo sobre un overlay oscuro.
 */
function FotoExpandible({ src, alt, className }: { src: string; alt: string; className?: string }) {
  const [expandida, setExpandida] = useState(false)
  return (
    <>
      <img
        src={src}
        alt={alt}
        onClick={() => setExpandida(true)}
        className={`cursor-zoom-in hover:opacity-90 transition-opacity ${className}`}
      />
      {expandida && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80"
          onClick={() => setExpandida(false)}
        >
          <img src={src} alt={alt} className="max-w-3xl max-h-[90vh] object-contain rounded-2xl shadow-2xl" />
          <button
            onClick={() => setExpandida(false)}
            className="absolute top-4 right-4 text-white bg-black/50 rounded-full w-8 h-8 flex items-center justify-center"
          >
            X
          </button>
        </div>
      )}
    </>
  )
}

export default function ModalHistorialTareas({ tecnico, onCerrar }: Props) {
  const [tareas, setTareas] = useState<Tarea[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroEstado, setFiltroEstado] = useState('todas')
  const [filtroPeriodo, setFiltroPeriodo] = useState('todo')
  const [tareaDetalle, setTareaDetalle] = useState<Tarea | null>(null)

  // Cargar historial completo del tecnico al abrir el modal
  useEffect(() => {
    const cargar = async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/admin/tecnicos/${tecnico.id}/tareas`)
        const data = await res.json()
        if (data.success) setTareas(data.tareas)
      } finally {
        setLoading(false)
      }
    }
    cargar()
  }, [tecnico.id])

  /**
   * Filtro por estado — el filtro "con_atraso" usa motivo_atraso !== null
   * para incluir tareas que tuvieron atraso aunque luego se completaron.
   */
  const filtrarPorEstado = (tarea: Tarea) => {
    if (filtroEstado === 'todas') return true
    if (filtroEstado === 'con_atraso') return tarea.motivo_atraso !== null
    return tarea.estado === filtroEstado
  }

  /**
   * Filtro por periodo — compara la fecha de creacion de la tarea
   * contra el rango seleccionado (semana = ultimos 7 dias, mes = mes actual).
   */
  const filtrarPorPeriodo = (tarea: Tarea) => {
    if (filtroPeriodo === 'todo') return true
    const fecha = new Date(tarea.creado_en)
    const ahora = new Date()
    if (filtroPeriodo === 'semana') {
      return fecha >= new Date(ahora.getTime() - 7 * 24 * 60 * 60 * 1000)
    }
    if (filtroPeriodo === 'mes') {
      return fecha.getMonth() === ahora.getMonth() && fecha.getFullYear() === ahora.getFullYear()
    }
    return true
  }

  const tareasFiltradas = tareas.filter(filtrarPorEstado).filter(filtrarPorPeriodo)

  // Estadisticas calculadas sobre el total de tareas sin filtros
  const stats = {
    total:      tareas.length,
    completadas: tareas.filter(t => t.estado === 'completada').length,
    conAtraso:  tareas.filter(t => t.motivo_atraso !== null).length, // independiente del estado final
    canceladas: tareas.filter(t => t.estado === 'cancelada').length,
  }

  const formatFecha = (fecha: string) => new Date(fecha).toLocaleDateString('es-CL', {
    day: '2-digit', month: 'short', year: 'numeric'
  })

  /**
   * Calcula la duracion real de la tarea en dias y horas.
   * Retorna null si la tarea no tiene fecha de completado.
   */
  const calcularDuracion = (tarea: Tarea) => {
    if (!tarea.completada_en) return null
    const diff = new Date(tarea.completada_en).getTime() - new Date(tarea.creado_en).getTime()
    const dias  = Math.floor(diff / (1000 * 60 * 60 * 24))
    const horas = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
    if (dias > 0) return `${dias}d ${horas}h`
    return `${horas}h`
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onCerrar}
    >
      <div
        className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header con avatar y datos del tecnico */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-slate-900 text-white flex items-center justify-center font-black text-sm flex-shrink-0">
              {tecnico.nombre.charAt(0)}
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Historial de tareas</h3>
              <p className="text-xs text-slate-400">{tecnico.nombre} — {tecnico.email}</p>
            </div>
          </div>
          <button onClick={onCerrar} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-400">X</button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Panel izquierdo — estadisticas, filtros y tabla */}
          <div className={`flex flex-col ${tareaDetalle ? 'w-1/2 border-r border-slate-100' : 'w-full'} overflow-hidden`}>

            {/* Estadisticas rapidas sobre el total sin filtros */}
            <div className="grid grid-cols-4 gap-3 px-6 py-4 bg-slate-50 border-b border-slate-100 flex-shrink-0">
              {[
                { label: 'Total',      value: stats.total,       color: 'text-slate-900' },
                { label: 'Completadas', value: stats.completadas, color: 'text-green-600' },
                { label: 'Con atraso', value: stats.conAtraso,   color: 'text-amber-600' },
                { label: 'Canceladas', value: stats.canceladas,  color: 'text-red-500' },
              ].map(s => (
                <div key={s.label} className="text-center">
                  <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
                  <p className="text-xs text-slate-400">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Filtros por estado y periodo */}
            <div className="px-6 py-3 border-b border-slate-100 space-y-2 flex-shrink-0">
              <div className="flex gap-1.5 flex-wrap">
                {FILTROS_ESTADO.map(f => (
                  <button key={f} onClick={() => setFiltroEstado(f)}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${filtroEstado === f ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                  >
                    {ESTADO_LABELS[f]}
                  </button>
                ))}
              </div>
              <div className="flex gap-1.5 items-center">
                {FILTROS_PERIODO.map(f => (
                  <button key={f} onClick={() => setFiltroPeriodo(f)}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${filtroPeriodo === f ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                  >
                    {PERIODO_LABELS[f]}
                  </button>
                ))}
                <span className="text-xs text-slate-400 ml-auto">
                  {tareasFiltradas.length} resultado{tareasFiltradas.length !== 1 ? 's' : ''}
                </span>
              </div>
            </div>

            {/* Tabla de tareas filtradas */}
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="space-y-2 p-4">
                  {[1,2,3,4].map(i => <div key={i} className="h-14 bg-slate-100 rounded-xl animate-pulse" />)}
                </div>
              ) : tareasFiltradas.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40">
                  <p className="text-slate-400 text-sm">Sin tareas para este filtro</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {/* Cabecera de columnas sticky */}
                  <div className="grid grid-cols-12 gap-3 px-6 py-2 bg-slate-50 text-xs font-bold text-slate-400 uppercase tracking-wider sticky top-0">
                    <div className="col-span-1">#</div>
                    <div className="col-span-3">Categoria</div>
                    <div className="col-span-2">Estado</div>
                    <div className="col-span-3">Fecha</div>
                    <div className="col-span-2">Duracion</div>
                    <div className="col-span-1"></div>
                  </div>

                  {tareasFiltradas.map(tarea => {
                    const isSelected  = tareaDetalle?.id === tarea.id
                    const tuvoAtraso  = tarea.motivo_atraso !== null

                    return (
                      <div
                        key={tarea.id}
                        onClick={() => setTareaDetalle(isSelected ? null : tarea)}
                        className={`grid grid-cols-12 gap-3 px-6 py-3 items-center cursor-pointer transition-colors ${isSelected ? 'bg-slate-100' : 'hover:bg-slate-50'}`}
                      >
                        <div className="col-span-1">
                          <span className="text-xs font-mono text-slate-400">#{tarea.id}</span>
                        </div>
                        <div className="col-span-3">
                          <p className="text-xs font-semibold text-slate-800 truncate">
                            {tarea.incidencia?.categoria?.nombre ?? '—'}
                          </p>
                          {/* Indicador de atraso visible aunque la tarea haya terminado como completada */}
                          {tuvoAtraso && <p className="text-xs text-amber-500">tuvo atraso</p>}
                        </div>
                        <div className="col-span-2">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${ESTADO_COLORS[tarea.estado] ?? 'bg-slate-100 text-slate-500'}`}>
                            {tarea.estado}
                          </span>
                        </div>
                        <div className="col-span-3">
                          <p className="text-xs text-slate-500">{formatFecha(tarea.creado_en)}</p>
                        </div>
                        <div className="col-span-2">
                          <p className="text-xs text-slate-500">{calcularDuracion(tarea) ?? '—'}</p>
                        </div>
                        <div className="col-span-1 text-right">
                          <span className={`text-slate-300 text-xs transition-transform inline-block ${isSelected ? 'rotate-90' : ''}`}>
                            {'>'}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Panel derecho — detalle de la tarea seleccionada */}
          {tareaDetalle && (
            <div className="w-1/2 overflow-y-auto">
              <div className="p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-slate-900">
                    Tarea #{tareaDetalle.id} — Incidencia #{tareaDetalle.incidencia?.id}
                  </h4>
                  <button onClick={() => setTareaDetalle(null)} className="text-slate-400 hover:text-slate-600 text-xs">X</button>
                </div>

                {/* Fotos lado a lado: reporte ciudadano y evidencia del tecnico */}
                <div className="grid grid-cols-2 gap-2">
                  {tareaDetalle.incidencia?.reportes?.[0]?.foto_url && (
                    <div>
                      <p className="text-xs text-slate-400 mb-1 font-semibold">Reporte ciudadano</p>
                      <FotoExpandible
                        src={tareaDetalle.incidencia.reportes[0].foto_url}
                        alt="Reporte"
                        className="w-full h-32 object-cover rounded-xl"
                      />
                    </div>
                  )}
                  {tareaDetalle.foto_evidencia_url && (
                    <div>
                      <p className="text-xs text-slate-400 mb-1 font-semibold">Evidencia tecnico</p>
                      <FotoExpandible
                        src={tareaDetalle.foto_evidencia_url}
                        alt="Evidencia"
                        className="w-full h-32 object-cover rounded-xl"
                      />
                    </div>
                  )}
                </div>

                {/* Metricas de la tarea */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-slate-50 rounded-xl p-3 text-center">
                    <p className="text-xs text-slate-400 mb-1">Estado</p>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${ESTADO_COLORS[tareaDetalle.estado]}`}>
                      {tareaDetalle.estado}
                    </span>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-3 text-center">
                    <p className="text-xs text-slate-400 mb-1">Prioridad</p>
                    <p className={`text-lg font-black ${Math.round(tareaDetalle.incidencia?.puntaje_prioridad ?? 0) >= 70 ? 'text-red-600' : 'text-slate-700'}`}>
                      {Math.round(tareaDetalle.incidencia?.puntaje_prioridad ?? 0)}
                    </p>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-3 text-center">
                    <p className="text-xs text-slate-400 mb-1">Duracion</p>
                    <p className="text-lg font-black text-slate-700">{calcularDuracion(tareaDetalle) ?? '—'}</p>
                  </div>
                </div>

                {/* Descripcion del ciudadano — contexto del problema original */}
                {tareaDetalle.incidencia?.reportes?.[0]?.descripcion && (
                  <div className="bg-slate-50 rounded-xl p-3">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Descripcion ciudadano</p>
                    <p className="text-sm text-slate-700">{tareaDetalle.incidencia.reportes[0].descripcion}</p>
                  </div>
                )}

                {/* Resumen tecnico generado por la IA al clasificar el reporte */}
                {tareaDetalle.incidencia?.reportes?.[0]?.resumen_ia && (
                  <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
                    <p className="text-xs font-bold text-blue-400 uppercase tracking-wider mb-1">
                      Resumen tecnico IA
                      {tareaDetalle.incidencia.reportes[0].confianza_ia && (
                        <span className="ml-2 font-normal normal-case">
                          confianza {tareaDetalle.incidencia.reportes[0].confianza_ia}%
                        </span>
                      )}
                    </p>
                    <p className="text-sm text-blue-800">{tareaDetalle.incidencia.reportes[0].resumen_ia}</p>
                  </div>
                )}

                {/* Fechas de asignacion y completado */}
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Asignada</span>
                    <span className="text-slate-700 font-medium">{formatFecha(tareaDetalle.creado_en)}</span>
                  </div>
                  {tareaDetalle.completada_en && (
                    <div className="flex justify-between">
                      <span className="text-slate-400">Completada</span>
                      <span className="text-green-600 font-medium">{formatFecha(tareaDetalle.completada_en)}</span>
                    </div>
                  )}
                </div>

                {/* Motivo de atraso registrado por el tecnico */}
                {tareaDetalle.motivo_atraso && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                    <p className="text-xs font-bold text-amber-600 mb-1">Motivo de atraso</p>
                    <p className="text-sm text-amber-800">{tareaDetalle.motivo_atraso}</p>
                  </div>
                )}

                {/* Motivo de cancelacion registrado por el admin */}
                {tareaDetalle.motivo_cancelacion && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                    <p className="text-xs font-bold text-red-600 mb-1">Motivo de cancelacion</p>
                    <p className="text-sm text-red-800">{tareaDetalle.motivo_cancelacion}</p>
                  </div>
                )}

                {/* Enlace a Google Maps con las coordenadas de la incidencia */}
                {tareaDetalle.incidencia?.latitud && (
                 <a 
                    href={`https://www.google.com/maps?q=${tareaDetalle.incidencia.latitud},${tareaDetalle.incidencia.longitud}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full border border-slate-200 rounded-xl py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                  >
                    Ver ubicacion en Google Maps
                  </a>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}