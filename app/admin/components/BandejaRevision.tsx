'use client'

/**
 * BandejaRevision.tsx — Bandeja de revision y aprobacion manual de reportes (RF-17, RF-18).
 *
 * Muestra los reportes en estado 'pendiente_revision' — aquellos que la IA no pudo
 * aprobar automaticamente por baja confianza o categoria no identificada.
 * El administrador los revisa uno a uno y decide aprobar o rechazar.
 *
 * Flujo de aprobacion en 2 pasos:
 *   Paso 1 — Revisar reporte: foto, descripcion, resumen IA, confianza.
 *             El admin confirma o corrige la categoria sugerida por la IA.
 *   Paso 2 — Seleccionar tecnico: lista de tecnicos con especialidad en la
 *             categoria elegida, con carga de trabajo actual expandible.
 *
 * La calle se obtiene por geocodificacion inversa al abrir el modal, no al cargar
 * la lista, para evitar saturar la API de Jawg. Se cachea por reporte_id.
 *
 * Al confirmar, notifica al padre via onActualizarPendientes para actualizar
 * el badge del sidebar con el nuevo conteo de pendientes.
 *
 * Usado por: app/admin/page.tsx
 * Depende de: GET /api/admin/reportes,
 *             GET /api/categorias,
 *             GET /api/admin/tecnicos/especialidad,
 *             PATCH /api/admin/reportes/[id],
 *             getCalle (geocodificacion inversa)
 */

import { useEffect, useState, useCallback } from 'react'
import { getCalle } from '../../lib/utils/geo'

interface Reporte {
  id: number
  descripcion: string
  foto_url: string
  latitud: string
  longitud: string
  confianza_ia: number | null
  resumen_ia: string | null
  creado_en: string
  categoria_ia: { id: number; nombre: string } | null
}

interface Tecnico {
  id: number
  nombre: string
  email: string
  tareas: { id: number; estado: string }[]
}

interface Categoria {
  id: number
  nombre: string
}

/**
 * Barra visual de confianza de la IA.
 * Verde >= 60%, amarillo >= 30%, rojo < 30%.
 */
function BarraConfianza({ valor }: { valor: number | null }) {
  if (!valor && valor !== 0) return <span className="text-xs text-slate-400 italic">Sin datos IA</span>
  const color     = valor >= 60 ? 'bg-green-500' : valor >= 30 ? 'bg-amber-500' : 'bg-red-400'
  const textColor = valor >= 60 ? 'text-green-600' : valor >= 30 ? 'text-amber-600' : 'text-red-500'
  const label     = valor >= 60 ? 'Alta' : valor >= 30 ? 'Media' : 'Baja'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${valor}%` }} />
      </div>
      <span className={`text-xs font-bold ${textColor}`}>{label} · {valor}%</span>
    </div>
  )
}

// Colores de badge por nombre de categoria
const CAT_COLORS: Record<string, string> = {
  'Pavimento':    'bg-slate-700 text-white',
  'Veredas':      'bg-blue-600 text-white',
  'Areas Verdes': 'bg-green-600 text-white',
  'Senaletica':   'bg-amber-500 text-white',
  'Residuos':     'bg-orange-500 text-white',
  'Mobiliario':   'bg-purple-600 text-white',
}

export default function BandejaRevision({ onActualizarPendientes }: { onActualizarPendientes: () => void }) {
  const [reportes, setReportes] = useState<Reporte[]>([])
  const [loading, setLoading] = useState(true)
  // Categorias cargadas desde BD — IDs reales, sin hardcodear
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [reporteModal, setReporteModal] = useState<Reporte | null>(null)
  const [calleModal, setCalleModal] = useState<string>('')
  const [paso, setPaso] = useState<1 | 2>(1)
  const [tecnicosPorEspecialidad, setTecnicosPorEspecialidad] = useState<Tecnico[]>([])
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState<number | null>(null)
  const [tecnicoSeleccionado, setTecnicoSeleccionado] = useState<number | null>(null)
  const [tecnicoExpandido, setTecnicoExpandido] = useState<number | null>(null)
  const [showModalRechazo, setShowModalRechazo] = useState(false)
  const [procesando, setProcesando] = useState(false)
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)
  // Cache de calles por reporte_id — evita llamadas repetidas al abrir el mismo modal
  const [callesCache, setCallesCache] = useState<Record<number, string>>({})

  /**
   * Carga reportes y categorias en paralelo.
   * useCallback evita recrear la funcion en cada render y permite llamarla
   * desde handlers sin causar loops de efectos.
   */
  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const [repRes, catRes] = await Promise.all([
        fetch('/api/admin/reportes'),
        fetch('/api/categorias')
      ])
      const repData = await repRes.json()
      const catData = await catRes.json()
      if (repData.success) setReportes(repData.reportes)
      // Categorias con IDs reales desde BD — evita el bug de indice hardcodeado
      if (catData.categorias) setCategorias(catData.categorias)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  /**
   * Carga tecnicos con especialidad cuando el admin cambia la categoria seleccionada.
   * Se ejecuta automaticamente al cambiar categoriaSeleccionada.
   */
  useEffect(() => {
    if (!categoriaSeleccionada) return
    fetch(`/api/admin/tecnicos/especialidad?categoriaId=${categoriaSeleccionada}`)
      .then(r => r.json())
      .then(data => { if (data.success) setTecnicosPorEspecialidad(data.tecnicos) })
  }, [categoriaSeleccionada])

  const mostrarMensaje = (tipo: 'ok' | 'error', texto: string) => {
    setMensaje({ tipo, texto })
    setTimeout(() => setMensaje(null), 4000)
  }

  /**
   * Abre el modal de revision y precarga la categoria sugerida por la IA.
   * La calle se obtiene al abrir, no al cargar la lista, para no saturar Jawg.
   */
  const abrirModal = async (reporte: Reporte) => {
    setReporteModal(reporte)
    setPaso(1)
    setCategoriaSeleccionada(reporte.categoria_ia?.id ?? null)
    setTecnicoSeleccionado(null)
    setTecnicoExpandido(null)
    setTecnicosPorEspecialidad([])
    setShowModalRechazo(false)
    // Usar cache si la calle ya fue calculada para este reporte
    const calle = callesCache[reporte.id]
      ?? await getCalle(parseFloat(reporte.latitud), parseFloat(reporte.longitud))
    setCalleModal(calle)
    setCallesCache(prev => ({ ...prev, [reporte.id]: calle }))
  }

  const cerrarModal = () => {
    setReporteModal(null)
    setShowModalRechazo(false)
    setPaso(1)
  }

  /**
   * Aprueba el reporte con la categoria y tecnico seleccionados.
   * El endpoint crea la incidencia, asigna la tarea y actualiza el reporte.
   */
  const handleAprobar = async () => {
    if (!reporteModal || !categoriaSeleccionada || !tecnicoSeleccionado) return
    setProcesando(true)
    try {
      const res = await fetch(`/api/admin/reportes/${reporteModal.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accion: 'aprobar',
          categoriaId: categoriaSeleccionada,
          tecnicoId: tecnicoSeleccionado
        })
      })
      const data = await res.json()
      if (!res.ok) { mostrarMensaje('error', data.error); return }
      mostrarMensaje('ok', 'Reporte aprobado y tarea asignada correctamente')
      cerrarModal()
      cargar()
      onActualizarPendientes() // actualizar badge del sidebar
    } finally {
      setProcesando(false)
    }
  }

  /**
   * Rechaza el reporte — lo marca como 'descartado'.
   * Desaparece del mapa ciudadano y de la bandeja permanentemente.
   */
  const handleRechazar = async () => {
    if (!reporteModal) return
    setProcesando(true)
    try {
      const res = await fetch(`/api/admin/reportes/${reporteModal.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'rechazar' })
      })
      const data = await res.json()
      if (!res.ok) { mostrarMensaje('error', data.error); return }
      mostrarMensaje('ok', 'Reporte rechazado y descartado')
      cerrarModal()
      cargar()
      onActualizarPendientes()
    } finally {
      setProcesando(false)
    }
  }

  const formatFecha = (fecha: string) => new Date(fecha).toLocaleDateString('es-CL', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Bandeja de revision</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {reportes.length} reporte{reportes.length !== 1 ? 's' : ''} pendiente{reportes.length !== 1 ? 's' : ''} de aprobacion
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

      {loading ? (
        <div className="space-y-3">
          {[1,2,3,4].map(i => <div key={i} className="bg-white rounded-2xl border border-slate-200 h-24 animate-pulse" />)}
        </div>
      ) : reportes.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center">
          <p className="text-slate-700 font-semibold text-lg">Bandeja vacia</p>
          <p className="text-slate-400 text-sm mt-1">No hay reportes pendientes de revision</p>
        </div>
      ) : (
        <div className="space-y-2">
          {reportes.map((reporte) => {
            const confianza = reporte.confianza_ia ?? 0
            // Color del borde izquierdo segun nivel de confianza de la IA
            const borderColor = confianza >= 60
              ? 'border-l-green-400'
              : confianza >= 30
                ? 'border-l-amber-400'
                : 'border-l-red-400'
            const calle = callesCache[reporte.id]

            return (
              <div
                key={reporte.id}
                onClick={() => abrirModal(reporte)}
                className={`bg-white rounded-2xl border border-slate-200 border-l-4 ${borderColor} p-4 flex gap-4 items-center cursor-pointer hover:shadow-md hover:border-slate-300 transition-all duration-200 group`}
              >
                <div className="relative flex-shrink-0 w-20 h-20 rounded-xl overflow-hidden">
                  <img src={reporte.foto_url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all duration-200 flex items-center justify-center">
                    <span className="text-white text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity">Ver</span>
                  </div>
                </div>

                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex items-start justify-between gap-4">
                    <p className="text-sm font-semibold text-slate-800 line-clamp-1 group-hover:text-slate-900">
                      {reporte.descripcion}
                    </p>
                    <span className="text-xs text-slate-400 flex-shrink-0">{formatFecha(reporte.creado_en)}</span>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {reporte.categoria_ia ? (
                      <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${CAT_COLORS[reporte.categoria_ia.nombre] ?? 'bg-slate-200 text-slate-700'}`}>
                        {reporte.categoria_ia.nombre}
                      </span>
                    ) : (
                      <span className="text-xs bg-slate-100 text-slate-500 px-2.5 py-0.5 rounded-full">Sin categoria</span>
                    )}
                    {/* Direccion de la fila — aparece si ya fue calculada desde un modal anterior */}
                    {calle && <span className="text-xs text-slate-500">📍 {calle}</span>}
                  </div>

                  <div className="max-w-48">
                    <BarraConfianza valor={reporte.confianza_ia} />
                  </div>
                </div>

                <span className="text-slate-300 group-hover:text-slate-500 group-hover:translate-x-1 transition-all text-lg flex-shrink-0">→</span>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal principal de revision — 2 pasos */}
      {reporteModal && !showModalRechazo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={cerrarModal}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[92vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            {/* Header con indicador de pasos */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
              <div className="flex items-center gap-3">
                {paso === 2 && (
                  <button onClick={() => setPaso(1)} className="text-xs font-medium text-slate-500 hover:text-slate-800">
                    Volver
                  </button>
                )}
                <h2 className="text-base font-bold text-slate-900">
                  {paso === 1 ? 'Revisar reporte' : 'Seleccionar tecnico'}
                </h2>
                {/* Barra de progreso de pasos */}
                <div className="flex gap-1 ml-2">
                  {[1,2].map(n => (
                    <span key={n} className={`h-1.5 rounded-full transition-all duration-300 ${n <= paso ? 'bg-slate-900 w-6' : 'bg-slate-200 w-4'}`} />
                  ))}
                </div>
              </div>
              <button onClick={cerrarModal} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-400">X</button>
            </div>

            {/* Paso 1: revisar reporte, confirmar o corregir categoria */}
            {paso === 1 && (
              <div className="flex flex-1 overflow-hidden">
                {/* Foto del reporte con direccion superpuesta */}
                <div className="w-80 flex-shrink-0 bg-slate-900 relative">
                  <img src={reporteModal.foto_url} alt="Reporte" className="w-full h-full object-cover opacity-90" style={{ maxHeight: '520px' }} />
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
                    <p className="text-white text-xs font-medium">📍 {calleModal || 'Calculando direccion...'}</p>
                    <p className="text-white/60 text-xs mt-0.5">{formatFecha(reporteModal.creado_en)}</p>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4">
                  {/* Selector de categoria — precargada con la sugerencia de la IA */}
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Categoria sugerida por IA</p>
                    <div className="flex flex-wrap gap-2">
                      {/* IDs reales desde BD — sin hardcodear i+1 como indice */}
                      {categorias.map((cat) => (
                        <button
                          key={cat.id}
                          onClick={() => setCategoriaSeleccionada(cat.id)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border-2 ${
                            categoriaSeleccionada === cat.id
                              ? `${CAT_COLORS[cat.nombre] ?? 'bg-slate-700 text-white'} border-transparent shadow-md`
                              : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400'
                          }`}
                        >
                          {cat.nombre}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Confianza IA</p>
                    <BarraConfianza valor={reporteModal.confianza_ia} />
                  </div>

                  {/* Descripcion del ciudadano */}
                  <div className="bg-slate-50 rounded-2xl p-4">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Descripcion del ciudadano</p>
                    <p className="text-sm text-slate-700 leading-relaxed">{reporteModal.descripcion}</p>
                  </div>

                  {/* Resumen tecnico generado por la IA */}
                  {reporteModal.resumen_ia && (
                    <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
                      <p className="text-xs font-bold text-blue-400 uppercase tracking-wider mb-2">Resumen tecnico IA</p>
                      <p className="text-sm text-blue-800 leading-relaxed">{reporteModal.resumen_ia}</p>
                    </div>
                  )}

                  <div className="flex gap-3 mt-auto pt-2">
                    <button
                      onClick={() => setShowModalRechazo(true)}
                      className="flex-1 border-2 border-slate-200 rounded-2xl py-3 text-sm font-semibold text-slate-500 hover:border-red-300 hover:text-red-500 hover:bg-red-50 transition-all"
                    >
                      Rechazar
                    </button>
                    <button
                      onClick={() => { if (categoriaSeleccionada) setPaso(2) }}
                      disabled={!categoriaSeleccionada}
                      className="flex-1 bg-slate-900 text-white rounded-2xl py-3 text-sm font-bold hover:bg-slate-700 disabled:bg-slate-200 disabled:text-slate-400 transition-all"
                    >
                      Elegir tecnico
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Paso 2: seleccionar tecnico con especialidad en la categoria elegida */}
            {paso === 2 && (
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                <p className="text-sm text-slate-500">
                  Selecciona el tecnico que atendera esta incidencia. Puedes expandir cada tarjeta para ver su carga de trabajo actual.
                </p>

                {tecnicosPorEspecialidad.length === 0 ? (
                  <div className="text-center py-12 bg-slate-50 rounded-2xl">
                    <p className="text-slate-500 font-medium">No hay tecnicos disponibles</p>
                    <p className="text-slate-400 text-sm mt-1">No existen tecnicos con especialidad en esta categoria</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {tecnicosPorEspecialidad.map(tecnico => {
                      const tareasActivas = tecnico.tareas.length
                      const isSelected   = tecnicoSeleccionado === tecnico.id
                      const isExpanded   = tecnicoExpandido === tecnico.id

                      return (
                        <div key={tecnico.id} className={`border-2 rounded-2xl overflow-hidden transition-all duration-200 ${isSelected ? 'border-slate-900 shadow-lg' : 'border-slate-200 hover:border-slate-300'}`}>
                          <div className="flex items-center gap-4 p-4 cursor-pointer" onClick={() => setTecnicoExpandido(isExpanded ? null : tecnico.id)}>
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
                            {/* Badge de carga de trabajo — verde=libre, amarillo=ocupado, rojo=sobrecargado */}
                            <span className={`text-xs font-bold px-3 py-1.5 rounded-full ${tareasActivas === 0 ? 'bg-green-100 text-green-700' : tareasActivas <= 2 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-600'}`}>
                              {tareasActivas === 0 ? 'Disponible' : `${tareasActivas} tarea${tareasActivas > 1 ? 's' : ''}`}
                            </span>
                            <span className={`text-slate-300 text-xs transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>v</span>
                          </div>

                          {/* Lista expandible de tareas activas del tecnico */}
                          {isExpanded && (
                            <div className="px-5 pb-4 pt-2 border-t border-slate-100 bg-slate-50">
                              {tareasActivas === 0 ? (
                                <p className="text-xs text-slate-400">Sin tareas activas — disponible para asignar</p>
                              ) : (
                                <div className="space-y-2">
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

                <div className="flex gap-3 pt-2">
                  <button onClick={() => setPaso(1)} className="flex-1 border-2 border-slate-200 rounded-2xl py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50">
                    Volver
                  </button>
                  <button
                    onClick={handleAprobar}
                    disabled={!tecnicoSeleccionado || procesando}
                    className="flex-1 bg-slate-900 text-white rounded-2xl py-3 text-sm font-bold hover:bg-slate-700 disabled:bg-slate-200 disabled:text-slate-400 transition-all"
                  >
                    {procesando ? 'Asignando...' : 'Confirmar asignacion'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal de confirmacion de rechazo */}
      {showModalRechazo && reporteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={cerrarModal}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-slate-900">Rechazar reporte</h2>
                <button onClick={cerrarModal} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-400">X</button>
              </div>
              {/* Preview del reporte a rechazar */}
              <div className="flex gap-3 bg-slate-50 rounded-2xl p-3 border border-slate-200">
                <img src={reporteModal.foto_url} className="w-20 h-20 rounded-xl object-cover flex-shrink-0" alt="" />
                <div className="min-w-0">
                  <p className="text-sm text-slate-700 font-medium line-clamp-2">{reporteModal.descripcion}</p>
                  <p className="text-xs text-slate-500 mt-1">📍 {calleModal || 'Calculando...'}</p>
                </div>
              </div>
              {/* Advertencia de irreversibilidad */}
              <div className="bg-red-50 rounded-xl p-4 border border-red-100 flex gap-3">
                <p className="text-sm text-red-700">
                  El reporte quedara como <strong>descartado</strong> y desaparecera permanentemente del mapa ciudadano. Esta accion no se puede deshacer.
                </p>
              </div>
              <div className="flex gap-3">
                <button onClick={cerrarModal} className="flex-1 border-2 border-slate-200 rounded-2xl py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50">
                  Cancelar
                </button>
                <button
                  onClick={handleRechazar}
                  disabled={procesando}
                  className="flex-1 bg-red-500 text-white rounded-2xl py-3 text-sm font-bold hover:bg-red-600 disabled:bg-slate-300 transition-all"
                >
                  {procesando ? 'Rechazando...' : 'Confirmar rechazo'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}