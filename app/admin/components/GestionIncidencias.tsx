'use client'

/**
 * GestionIncidencias.tsx — Vista de gestion de incidencias activas (RF-19, RF-22).
 *
 * Muestra la tabla de incidencias no completadas con filtros por estado,
 * permite asignar un tecnico a incidencias sin asignar y cancelar tareas activas.
 *
 * Funcionalidades:
 *   - Tabla filtrable por estado (todas, pendiente, asignado, en_curso)
 *   - Panel lateral de detalle con foto, metricas, tarea y ubicacion
 *   - Modal de asignacion — carga tecnicos con especialidad en la categoria
 *   - Modal de cancelacion — requiere motivo obligatorio (RF-19)
 *
 * Logica de calle:
 *   La direccion se obtiene via getCalle al abrir el panel lateral — no al cargar
 *   la lista — para evitar multiples llamadas a la API de geocodificacion.
 *   Se cachea por incidencia_id para no repetir la llamada si se reabre el panel.
 *
 * Usado por: app/admin/page.tsx
 * Depende de: GET /api/admin/incidencias,
 *             GET /api/admin/tecnicos/especialidad,
 *             POST /api/admin/tareas,
 *             PATCH /api/admin/tareas/[id],
 *             getCalle (geocodificacion inversa)
 */

import { useEffect, useState, useCallback, useRef } from 'react'
import { getCalle } from '../../lib/utils/geo'

interface Incidencia {
  id: number
  estado: string
  puntaje_prioridad: number
  contador_reportes: number
  latitud: string
  longitud: string
  creado_en: string
  categoria: { id: number; nombre: string; peligrosidad: number }
  tareas: {
    id: number
    estado: string
    motivo_atraso: string | null
    tecnico: { id: number; nombre: string } | null
  }[]
  reportes: { descripcion: string; foto_url: string }[]
}

interface Tecnico {
  id: number
  nombre: string
  email: string
  tareas: { id: number; estado: string }[]
}

// Configuracion de badge por estado de incidencia
const ESTADO_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  pendiente:  { label: 'Sin asignar', color: 'bg-red-100 text-red-700',     dot: 'bg-red-500' },
  asignado:   { label: 'Asignado',    color: 'bg-blue-100 text-blue-700',   dot: 'bg-blue-500' },
  en_curso:   { label: 'En curso',    color: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500' },
  completado: { label: 'Completado',  color: 'bg-green-100 text-green-700', dot: 'bg-green-500' },
}

// Colores de badge por estado de tarea
const TAREA_ESTADO_CONFIG: Record<string, string> = {
  asignada:   'bg-slate-100 text-slate-600',
  aceptada:   'bg-blue-100 text-blue-700',
  en_curso:   'bg-amber-100 text-amber-700',
  atrasada:   'bg-red-100 text-red-700',
  completada: 'bg-green-100 text-green-700',
  cancelada:  'bg-slate-100 text-slate-400',
}

const FILTROS = ['todos', 'pendiente', 'asignado', 'en_curso']
const FILTRO_LABELS: Record<string, string> = {
  todos: 'Todas', pendiente: 'Sin asignar', asignado: 'Asignado', en_curso: 'En curso'
}

export default function GestionIncidencias() {
  const [incidencias, setIncidencias] = useState<Incidencia[]>([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState('todos')
  const [incidenciaSeleccionada, setIncidenciaSeleccionada] = useState<Incidencia | null>(null)
  const [callePanel, setCallePanel] = useState<string>('Calculando...')

  // Estado del modal de asignacion de tecnico
  const [showModalAsignar, setShowModalAsignar] = useState(false)
  const [incidenciaAsignar, setIncidenciaAsignar] = useState<Incidencia | null>(null)
  const [tecnicosDisponibles, setTecnicosDisponibles] = useState<Tecnico[]>([])
  const [tecnicoSeleccionado, setTecnicoSeleccionado] = useState<number | null>(null)
  const [tecnicoExpandido, setTecnicoExpandido] = useState<number | null>(null)
  const [procesandoAsignacion, setProcesandoAsignacion] = useState(false)

  // Estado del modal de cancelacion de tarea
  const [showModalCancelar, setShowModalCancelar] = useState(false)
  const [tareaACancelar, setTareaACancelar] = useState<{ id: number; tecnico: string } | null>(null)
  const [motivoCancelacion, setMotivoCancelacion] = useState('')
  const [procesando, setProcesando] = useState(false)
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)

  // Cache de calles por incidencia_id — evita llamadas repetidas al abrir el mismo panel
  const callesCache = useRef<Record<number, string>>({})

  /**
   * Carga las incidencias activas ordenadas por prioridad.
   * No carga las calles aqui — se obtienen al abrir el panel lateral.
   */
  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/incidencias')
      const data = await res.json()
      if (data.success) setIncidencias(data.incidencias)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  /**
   * Abre el panel lateral de detalle y carga la direccion si no esta en cache.
   * La direccion se obtiene via geocodificacion inversa al abrir, no al cargar la lista.
   */
  const abrirPanel = async (inc: Incidencia) => {
    setIncidenciaSeleccionada(inc)
    setCallePanel('Calculando...')
    const calle = callesCache.current[inc.id]
      ?? await getCalle(parseFloat(inc.latitud), parseFloat(inc.longitud))
    callesCache.current[inc.id] = calle
    setCallePanel(calle)
  }

  /**
   * Abre el modal de asignacion y carga los tecnicos con especialidad
   * en la categoria de la incidencia seleccionada.
   */
  const abrirModalAsignar = async (inc: Incidencia) => {
    setIncidenciaAsignar(inc)
    setTecnicoSeleccionado(null)
    setTecnicoExpandido(null)
    setTecnicosDisponibles([])
    setShowModalAsignar(true)

    const res = await fetch(`/api/admin/tecnicos/especialidad?categoriaId=${inc.categoria.id}`)
    const data = await res.json()
    if (data.success) setTecnicosDisponibles(data.tecnicos)
  }

  /**
   * Asigna el tecnico seleccionado a la incidencia.
   * Envia incidenciaId para que el endpoint reutilice la incidencia existente
   * en vez de crear una nueva (modo reasignacion del endpoint /api/admin/tareas).
   */
  const handleAsignarTecnico = async () => {
    if (!incidenciaAsignar || !tecnicoSeleccionado) return
    setProcesandoAsignacion(true)
    try {
      const res = await fetch('/api/admin/tareas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          categoriaId:  incidenciaAsignar.categoria.id,
          latitud:      parseFloat(incidenciaAsignar.latitud),
          longitud:     parseFloat(incidenciaAsignar.longitud),
          descripcion:  incidenciaAsignar.reportes[0]?.descripcion ?? 'Reasignacion manual',
          tecnicoId:    tecnicoSeleccionado,
          incidenciaId: incidenciaAsignar.id // indica al endpoint que use la incidencia existente
        })
      })
      const data = await res.json()
      if (!res.ok) { mostrarMensaje('error', data.error ?? 'Error al asignar'); return }
      mostrarMensaje('ok', 'Tecnico asignado correctamente')
      setShowModalAsignar(false)
      setIncidenciaSeleccionada(null)
      cargar()
    } finally {
      setProcesandoAsignacion(false)
    }
  }

  const mostrarMensaje = (tipo: 'ok' | 'error', texto: string) => {
    setMensaje({ tipo, texto })
    setTimeout(() => setMensaje(null), 4000)
  }

  /**
   * Cancela la tarea con el motivo ingresado.
   * La incidencia vuelve a estado 'pendiente' automaticamente en el servicio.
   */
  const handleCancelarTarea = async () => {
    if (!tareaACancelar || !motivoCancelacion.trim()) return
    setProcesando(true)
    try {
      const res = await fetch(`/api/admin/tareas/${tareaACancelar.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ motivoCancelacion: motivoCancelacion.trim() })
      })
      const data = await res.json()
      if (!res.ok) { mostrarMensaje('error', data.error); return }
      mostrarMensaje('ok', 'Tarea cancelada. La incidencia volvio a pendiente.')
      setShowModalCancelar(false)
      setMotivoCancelacion('')
      setTareaACancelar(null)
      setIncidenciaSeleccionada(null)
      cargar()
    } finally {
      setProcesando(false)
    }
  }

  const formatFecha = (fecha: string) => new Date(fecha).toLocaleDateString('es-CL', {
    day: '2-digit', month: 'short', year: 'numeric'
  })

  // Dias transcurridos desde la creacion de la incidencia
  const diasSinAtencion = (fecha: string) =>
    Math.floor((Date.now() - new Date(fecha).getTime()) / (1000 * 60 * 60 * 24))

  const filtradas = filtro === 'todos'
    ? incidencias
    : incidencias.filter(i => i.estado === filtro)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Gestion de incidencias</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {filtradas.length} incidencia{filtradas.length !== 1 ? 's' : ''} activa{filtradas.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button onClick={cargar} className="text-xs text-slate-500 hover:text-slate-900 border border-slate-200 hover:border-slate-400 rounded-xl px-4 py-2 transition-all">
          Actualizar
        </button>
      </div>

      {mensaje && (
        <div className={`rounded-xl px-4 py-3 text-sm font-medium border ${mensaje.tipo === 'ok' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
          {mensaje.texto}
        </div>
      )}

      {/* Filtros por estado */}
      <div className="flex gap-2">
        {FILTROS.map(f => (
          <button key={f} onClick={() => setFiltro(f)}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${filtro === f ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-400'}`}
          >
            {FILTRO_LABELS[f]}
            {f !== 'todos' && (
              <span className="ml-1.5 opacity-70">({incidencias.filter(i => i.estado === f).length})</span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1,2,3,4,5].map(i => <div key={i} className="h-16 bg-slate-100 rounded-2xl animate-pulse" />)}
        </div>
      ) : filtradas.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <p className="text-slate-600 font-medium">
            Sin incidencias {filtro !== 'todos' ? FILTRO_LABELS[filtro].toLowerCase() : 'activas'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="grid grid-cols-12 gap-4 px-5 py-3 bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-400 uppercase tracking-wider">
            <div className="col-span-1">ID</div>
            <div className="col-span-2">Categoria</div>
            <div className="col-span-2">Estado</div>
            <div className="col-span-2">Tecnico</div>
            <div className="col-span-1 text-center">Prioridad</div>
            <div className="col-span-1 text-center">Reportes</div>
            <div className="col-span-1 text-center">Dias</div>
            <div className="col-span-2 text-right">Acciones</div>
          </div>

          <div className="divide-y divide-slate-100">
            {filtradas.map(inc => {
              const estadoConf  = ESTADO_CONFIG[inc.estado] ?? ESTADO_CONFIG.pendiente
              const tareaActiva = inc.tareas[0]
              const tecnico     = tareaActiva?.tecnico
              const dias        = diasSinAtencion(inc.creado_en)
              const prioridad   = Math.round(inc.puntaje_prioridad)
              // Incidencia sin tecnico asignado — se puede asignar desde la tabla
              const sinAsignar  = inc.estado === 'pendiente' && !tareaActiva

              return (
                // Clic en la fila abre el panel lateral de detalle
                <div key={inc.id}
                  className="grid grid-cols-12 gap-4 px-5 py-4 items-center hover:bg-slate-50 transition-colors cursor-pointer"
                  onClick={() => abrirPanel(inc)}
                >
                  <div className="col-span-1">
                    <span className="text-sm font-mono text-slate-400">#{inc.id}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-sm font-semibold text-slate-800">{inc.categoria.nombre}</span>
                  </div>
                  <div className="col-span-2">
                    <span className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full w-fit ${estadoConf.color}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${estadoConf.dot}`} />
                      {estadoConf.label}
                    </span>
                  </div>
                  <div className="col-span-2">
                    {tecnico ? (
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600 flex-shrink-0">
                          {tecnico.nombre.charAt(0)}
                        </div>
                        <span className="text-xs text-slate-600 truncate">{tecnico.nombre}</span>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400 italic">Sin asignar</span>
                    )}
                  </div>
                  <div className="col-span-1 text-center">
                    {/* Rojo >= 70, amarillo >= 40, gris para prioridad baja */}
                    <span className={`text-sm font-black ${prioridad >= 70 ? 'text-red-600' : prioridad >= 40 ? 'text-amber-600' : 'text-slate-600'}`}>
                      {prioridad}
                    </span>
                  </div>
                  <div className="col-span-1 text-center">
                    <span className="text-sm font-semibold text-slate-700">{inc.contador_reportes}</span>
                  </div>
                  <div className="col-span-1 text-center">
                    {/* Rojo >= 7 dias, amarillo >= 3 dias */}
                    <span className={`text-sm font-semibold ${dias >= 7 ? 'text-red-600' : dias >= 3 ? 'text-amber-600' : 'text-slate-600'}`}>
                      {dias}d
                    </span>
                  </div>
                  {/* stopPropagation evita abrir el panel al hacer clic en los botones */}
                  <div className="col-span-2 flex justify-end gap-2" onClick={e => e.stopPropagation()}>
                    {sinAsignar && (
                      <button
                        onClick={() => abrirModalAsignar(inc)}
                        className="text-xs text-blue-600 hover:text-blue-800 border border-blue-200 hover:border-blue-400 hover:bg-blue-50 rounded-lg px-3 py-1.5 transition-all font-semibold"
                      >
                        Asignar
                      </button>
                    )}
                    {tareaActiva && ['asignada','aceptada','en_curso','atrasada'].includes(tareaActiva.estado) && (
                      <button
                        onClick={() => {
                          setTareaACancelar({ id: tareaActiva.id, tecnico: tecnico?.nombre ?? 'tecnico' })
                          setShowModalCancelar(true)
                        }}
                        className="text-xs text-red-500 hover:text-red-700 border border-red-200 hover:border-red-400 hover:bg-red-50 rounded-lg px-3 py-1.5 transition-all"
                      >
                        Cancelar
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Panel lateral de detalle — se muestra solo si no hay modales abiertos */}
      {incidenciaSeleccionada && !showModalCancelar && !showModalAsignar && (
        <div className="fixed inset-0 z-50 flex justify-end" onClick={() => setIncidenciaSeleccionada(null)}>
          <div
            className="w-full max-w-md bg-white h-full shadow-2xl overflow-y-auto border-l border-slate-200"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white z-10">
              <div>
                <h3 className="text-base font-bold text-slate-900">Incidencia #{incidenciaSeleccionada.id}</h3>
                <p className="text-xs text-slate-400">{incidenciaSeleccionada.categoria.nombre}</p>
              </div>
              <button onClick={() => setIncidenciaSeleccionada(null)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-400">X</button>
            </div>

            <div className="p-6 space-y-5">
              {/* Foto del reporte ciudadano */}
              {incidenciaSeleccionada.reportes[0] && (
                <img src={incidenciaSeleccionada.reportes[0].foto_url} alt="Reporte" className="w-full h-48 object-cover rounded-2xl" />
              )}

              {/* Metricas de la incidencia */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-slate-50 rounded-xl p-3 text-center">
                  <p className="text-xs text-slate-400 mb-1">Estado</p>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${ESTADO_CONFIG[incidenciaSeleccionada.estado]?.color}`}>
                    {ESTADO_CONFIG[incidenciaSeleccionada.estado]?.label}
                  </span>
                </div>
                <div className="bg-slate-50 rounded-xl p-3 text-center">
                  <p className="text-xs text-slate-400 mb-1">Prioridad</p>
                  <p className={`text-xl font-black ${Math.round(incidenciaSeleccionada.puntaje_prioridad) >= 70 ? 'text-red-600' : Math.round(incidenciaSeleccionada.puntaje_prioridad) >= 40 ? 'text-amber-600' : 'text-slate-700'}`}>
                    {Math.round(incidenciaSeleccionada.puntaje_prioridad)}
                  </p>
                </div>
                <div className="bg-slate-50 rounded-xl p-3 text-center">
                  <p className="text-xs text-slate-400 mb-1">Reportes</p>
                  <p className="text-xl font-black text-slate-700">{incidenciaSeleccionada.contador_reportes}</p>
                </div>
              </div>

              {/* Descripcion del ciudadano */}
              {incidenciaSeleccionada.reportes[0] && (
                <div className="bg-slate-50 rounded-xl p-4">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Descripcion ciudadano</p>
                  <p className="text-sm text-slate-700">{incidenciaSeleccionada.reportes[0].descripcion}</p>
                </div>
              )}

              {/* Fechas y ubicacion */}
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-400">Creada</span>
                  <span className="text-slate-700 font-medium">{formatFecha(incidenciaSeleccionada.creado_en)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Dias sin resolucion</span>
                  <span className={`font-bold ${diasSinAtencion(incidenciaSeleccionada.creado_en) >= 7 ? 'text-red-600' : 'text-slate-700'}`}>
                    {diasSinAtencion(incidenciaSeleccionada.creado_en)} dias
                  </span>
                </div>
                <div className="flex justify-between items-start gap-4">
                  <span className="text-slate-400 flex-shrink-0">Ubicacion</span>
                  <span className="text-slate-700 text-xs text-right">📍 {callePanel}</span>
                </div>
              </div>

              {/* Boton asignar — solo visible si pendiente sin tarea */}
              {incidenciaSeleccionada.estado === 'pendiente' && incidenciaSeleccionada.tareas.length === 0 && (
                <button
                  onClick={() => abrirModalAsignar(incidenciaSeleccionada)}
                  className="w-full bg-blue-600 text-white rounded-2xl py-3 text-sm font-bold hover:bg-blue-700 transition-colors"
                >
                  Asignar tecnico
                </button>
              )}

              {/* Detalle de la tarea asignada */}
              {incidenciaSeleccionada.tareas.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Tarea asignada</p>
                  {incidenciaSeleccionada.tareas.map(tarea => (
                    <div key={tarea.id} className="border border-slate-200 rounded-2xl p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono text-slate-400">Tarea #{tarea.id}</span>
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${TAREA_ESTADO_CONFIG[tarea.estado] ?? 'bg-slate-100 text-slate-500'}`}>
                          {tarea.estado}
                        </span>
                      </div>
                      {tarea.tecnico && (
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600">
                            {tarea.tecnico.nombre.charAt(0)}
                          </div>
                          <span className="text-sm font-medium text-slate-700">{tarea.tecnico.nombre}</span>
                        </div>
                      )}
                      {tarea.motivo_atraso && (
                        <div className="bg-red-50 rounded-xl p-3">
                          <p className="text-xs text-red-600 font-semibold">Motivo atraso: {tarea.motivo_atraso}</p>
                        </div>
                      )}
                      {['asignada','aceptada','en_curso','atrasada'].includes(tarea.estado) && (
                        <button
                          onClick={() => {
                            setTareaACancelar({ id: tarea.id, tecnico: tarea.tecnico?.nombre ?? 'tecnico' })
                            setShowModalCancelar(true)
                          }}
                          className="w-full border-2 border-red-200 text-red-500 hover:bg-red-50 hover:border-red-300 rounded-xl py-2 text-xs font-bold transition-all"
                        >
                          Cancelar esta tarea
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <a
                href={`https://www.google.com/maps?q=${incidenciaSeleccionada.latitud},${incidenciaSeleccionada.longitud}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full border border-slate-200 rounded-2xl py-3 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Ver ubicacion en Google Maps
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Modal asignar tecnico a incidencia pendiente */}
      {showModalAsignar && incidenciaAsignar && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={() => setShowModalAsignar(false)}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
              <div>
                <h3 className="text-base font-bold text-slate-900">Asignar tecnico</h3>
                <p className="text-xs text-slate-400">Incidencia #{incidenciaAsignar.id} — {incidenciaAsignar.categoria.nombre}</p>
              </div>
              <button onClick={() => setShowModalAsignar(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-400">X</button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <p className="text-sm text-slate-500">Selecciona el tecnico que atendera esta incidencia.</p>

              {tecnicosDisponibles.length === 0 ? (
                <div className="text-center py-10 bg-slate-50 rounded-2xl">
                  <p className="text-slate-500 font-medium">No hay tecnicos disponibles con especialidad en {incidenciaAsignar.categoria.nombre}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {tecnicosDisponibles.map(tecnico => {
                    const tareasActivas = tecnico.tareas.length
                    const isSelected   = tecnicoSeleccionado === tecnico.id
                    const isExpanded   = tecnicoExpandido === tecnico.id

                    return (
                      <div key={tecnico.id} className={`border-2 rounded-2xl overflow-hidden transition-all ${isSelected ? 'border-slate-900 shadow-md' : 'border-slate-200 hover:border-slate-300'}`}>
                        <div className="flex items-center gap-3 p-4 cursor-pointer" onClick={() => setTecnicoExpandido(isExpanded ? null : tecnico.id)}>
                          <button
                            onClick={e => { e.stopPropagation(); setTecnicoSeleccionado(tecnico.id) }}
                            className={`w-6 h-6 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all ${isSelected ? 'border-slate-900 bg-slate-900' : 'border-slate-300 hover:border-slate-600'}`}
                          >
                            {isSelected && <span className="w-2.5 h-2.5 rounded-full bg-white block" />}
                          </button>
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-black flex-shrink-0 ${isSelected ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}>
                            {tecnico.nombre.charAt(0)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-slate-900">{tecnico.nombre}</p>
                            <p className="text-xs text-slate-400">{tecnico.email}</p>
                          </div>
                          {/* Badge de carga de trabajo con color segun cantidad de tareas activas */}
                          <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${tareasActivas === 0 ? 'bg-green-100 text-green-700' : tareasActivas <= 2 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-600'}`}>
                            {tareasActivas === 0 ? 'Disponible' : `${tareasActivas} tarea${tareasActivas > 1 ? 's' : ''}`}
                          </span>
                          <span className={`text-slate-300 text-xs transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>v</span>
                        </div>
                        {/* Detalle expandible con lista de tareas activas */}
                        {isExpanded && (
                          <div className="px-5 pb-4 pt-2 border-t border-slate-100 bg-slate-50">
                            {tareasActivas === 0 ? (
                              <p className="text-xs text-slate-400">Sin tareas activas — disponible para asignar</p>
                            ) : (
                              <div className="space-y-1.5">
                                {tecnico.tareas.map(t => (
                                  <div key={t.id} className="flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
                                    <span className="text-xs text-slate-600">Tarea #{t.id} — {t.estado}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="flex gap-3 p-6 border-t border-slate-100 flex-shrink-0">
              <button onClick={() => setShowModalAsignar(false)} className="flex-1 border-2 border-slate-200 rounded-2xl py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50">
                Cancelar
              </button>
              <button
                onClick={handleAsignarTecnico}
                disabled={!tecnicoSeleccionado || procesandoAsignacion}
                className="flex-1 bg-slate-900 text-white rounded-2xl py-3 text-sm font-bold hover:bg-slate-700 disabled:bg-slate-200 disabled:text-slate-400 transition-all"
              >
                {procesandoAsignacion ? 'Asignando...' : 'Confirmar asignacion'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal cancelar tarea activa */}
      {showModalCancelar && tareaACancelar && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={() => setShowModalCancelar(false)}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">Cancelar tarea #{tareaACancelar.id}</h3>
              <button onClick={() => setShowModalCancelar(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-400">X</button>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
              <p className="text-sm text-amber-800">
                La tarea asignada a <strong>{tareaACancelar.tecnico}</strong> sera cancelada
                y la incidencia volvera a estado <strong>pendiente</strong> para ser reasignada.
              </p>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">
                Motivo de cancelacion <span className="text-red-500">*</span>
              </label>
              <textarea
                value={motivoCancelacion}
                onChange={e => setMotivoCancelacion(e.target.value)}
                rows={3}
                placeholder="Describe el motivo de la cancelacion..."
                className="w-full border-2 border-slate-200 focus:border-slate-900 rounded-2xl px-4 py-3 text-sm text-slate-700 outline-none resize-none transition-colors"
              />
              <p className="text-xs text-slate-400 mt-1 text-right">{motivoCancelacion.length}/200</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => { setShowModalCancelar(false); setMotivoCancelacion('') }}
                className="flex-1 border-2 border-slate-200 rounded-2xl py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleCancelarTarea}
                disabled={!motivoCancelacion.trim() || procesando}
                className="flex-1 bg-red-500 text-white rounded-2xl py-3 text-sm font-bold hover:bg-red-600 disabled:bg-slate-200 disabled:text-slate-400 transition-all"
              >
                {procesando ? 'Cancelando...' : 'Confirmar cancelacion'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}