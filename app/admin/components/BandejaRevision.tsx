'use client'

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

function BarraConfianza({ valor }: { valor: number | null }) {
  if (!valor && valor !== 0) return <span className="text-xs text-slate-400 italic">Sin datos IA</span>
  const color = valor >= 60 ? 'bg-green-500' : valor >= 30 ? 'bg-amber-500' : 'bg-red-400'
  const textColor = valor >= 60 ? 'text-green-600' : valor >= 30 ? 'text-amber-600' : 'text-red-500'
  const label = valor >= 60 ? 'Alta' : valor >= 30 ? 'Media' : 'Baja'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${valor}%` }} />
      </div>
      <span className={`text-xs font-bold ${textColor}`}>{label} · {valor}%</span>
    </div>
  )
}

// Colores por nombre de categoría para los badges
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
  // Categorías cargadas desde BD — IDs reales, sin hardcodear
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
  const [callesCache, setCallesCache] = useState<Record<number, string>>({})

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      // Cargar reportes y categorías en paralelo
      const [repRes, catRes] = await Promise.all([
        fetch('/api/admin/reportes'),
        fetch('/api/categorias')
      ])
      const repData = await repRes.json()
      const catData = await catRes.json()

      // Solo cargar lista — calle se obtiene al abrir el modal (evita saturar Nominatim)
      if (repData.success) setReportes(repData.reportes)
      // Categorías con IDs reales desde BD — evita el bug de índice hardcodeado
      if (catData.categorias) setCategorias(catData.categorias)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  // Cargar técnicos con especialidad cuando cambia la categoría seleccionada
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

  const abrirModal = async (reporte: Reporte) => {
    setReporteModal(reporte)
    setPaso(1)
    // Usar el ID real de la categoría sugerida por la IA
    setCategoriaSeleccionada(reporte.categoria_ia?.id ?? null)
    setTecnicoSeleccionado(null)
    setTecnicoExpandido(null)
    setTecnicosPorEspecialidad([])
    setShowModalRechazo(false)
    // Cargar dirección solo al abrir el modal, usando caché si ya fue calculada
    const calle = callesCache[reporte.id] ?? await getCalle(parseFloat(reporte.latitud), parseFloat(reporte.longitud))
    setCalleModal(calle)
    setCallesCache(prev => ({ ...prev, [reporte.id]: calle }))
  }

  const cerrarModal = () => {
    setReporteModal(null)
    setShowModalRechazo(false)
    setPaso(1)
  }

  const handleAprobar = async () => {
    if (!reporteModal || !categoriaSeleccionada || !tecnicoSeleccionado) return
    setProcesando(true)
    try {
      const res = await fetch(`/api/admin/reportes/${reporteModal.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'aprobar', categoriaId: categoriaSeleccionada, tecnicoId: tecnicoSeleccionado })
      })
      const data = await res.json()
      if (!res.ok) { mostrarMensaje('error', data.error); return }
      mostrarMensaje('ok', '✅ Reporte aprobado y tarea asignada correctamente')
      cerrarModal()
      cargar()
      onActualizarPendientes()
    } finally {
      setProcesando(false)
    }
  }

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
      mostrarMensaje('ok', '🗑️ Reporte rechazado y descartado')
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
          <h1 className="text-2xl font-bold text-slate-900">Bandeja de revisión</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {reportes.length} reporte{reportes.length !== 1 ? 's' : ''} pendiente{reportes.length !== 1 ? 's' : ''} de aprobación
          </p>
        </div>
        <button onClick={cargar} className="text-xs text-slate-500 hover:text-slate-900 border border-slate-200 hover:border-slate-400 rounded-xl px-4 py-2 transition-all">
          ↻ Actualizar
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
          <p className="text-5xl mb-4">✅</p>
          <p className="text-slate-700 font-semibold text-lg">Bandeja vacía</p>
          <p className="text-slate-400 text-sm mt-1">No hay reportes pendientes de revisión</p>
        </div>
      ) : (
        <div className="space-y-2">
          {reportes.map((reporte) => {
            const confianza = reporte.confianza_ia ?? 0
            const borderColor = confianza >= 60 ? 'border-l-green-400' : confianza >= 30 ? 'border-l-amber-400' : 'border-l-red-400'
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
                    <span className="text-white text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity">Ver →</span>
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
                      <span className="text-xs bg-slate-100 text-slate-500 px-2.5 py-0.5 rounded-full">Sin categoría</span>
                    )}
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

      {/* Modal principal */}
      {reporteModal && !showModalRechazo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={cerrarModal}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[92vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
              <div className="flex items-center gap-3">
                {paso === 2 && (
                  <button onClick={() => setPaso(1)} className="text-xs font-medium text-slate-500 hover:text-slate-800">
                    ← Volver
                  </button>
                )}
                <h2 className="text-base font-bold text-slate-900">
                  {paso === 1 ? 'Revisar reporte' : 'Seleccionar técnico'}
                </h2>
                <div className="flex gap-1 ml-2">
                  {[1,2].map(n => (
                    <span key={n} className={`h-1.5 rounded-full transition-all duration-300 ${n <= paso ? 'bg-slate-900 w-6' : 'bg-slate-200 w-4'}`} />
                  ))}
                </div>
              </div>
              <button onClick={cerrarModal} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-400">✕</button>
            </div>

            {paso === 1 && (
              <div className="flex flex-1 overflow-hidden">
                <div className="w-80 flex-shrink-0 bg-slate-900 relative">
                  <img src={reporteModal.foto_url} alt="Reporte" className="w-full h-full object-cover opacity-90" style={{ maxHeight: '520px' }} />
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
                    <p className="text-white text-xs font-medium">📍 {calleModal || 'Calculando dirección...'}</p>
                    <p className="text-white/60 text-xs mt-0.5">{formatFecha(reporteModal.creado_en)}</p>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4">
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Categoría sugerida por IA</p>
                    <div className="flex flex-wrap gap-2">
                      {/* Usar IDs reales desde BD — sin hardcodear i+1 */}
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

                  <div className="bg-slate-50 rounded-2xl p-4">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Descripción del ciudadano</p>
                    <p className="text-sm text-slate-700 leading-relaxed">{reporteModal.descripcion}</p>
                  </div>

                  {reporteModal.resumen_ia && (
                    <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
                      <p className="text-xs font-bold text-blue-400 uppercase tracking-wider mb-2">Resumen técnico IA</p>
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
                      Elegir técnico →
                    </button>
                  </div>
                </div>
              </div>
            )}

            {paso === 2 && (
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                <p className="text-sm text-slate-500">
                  Selecciona el técnico que atenderá esta incidencia. Puedes expandir cada tarjeta para ver su carga de trabajo actual.
                </p>

                {tecnicosPorEspecialidad.length === 0 ? (
                  <div className="text-center py-12 bg-slate-50 rounded-2xl">
                    <p className="text-3xl mb-3">👥</p>
                    <p className="text-slate-500 font-medium">No hay técnicos disponibles</p>
                    <p className="text-slate-400 text-sm mt-1">No existen técnicos con especialidad en esta categoría</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {tecnicosPorEspecialidad.map(tecnico => {
                      const tareasActivas = tecnico.tareas.length
                      const isSelected = tecnicoSeleccionado === tecnico.id
                      const isExpanded = tecnicoExpandido === tecnico.id

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
                            <span className={`text-xs font-bold px-3 py-1.5 rounded-full ${tareasActivas === 0 ? 'bg-green-100 text-green-700' : tareasActivas <= 2 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-600'}`}>
                              {tareasActivas === 0 ? '✓ Disponible' : `${tareasActivas} tarea${tareasActivas > 1 ? 's' : ''}`}
                            </span>
                            <span className={`text-slate-300 text-xs transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>▼</span>
                          </div>

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
                    {procesando ? 'Asignando...' : 'Confirmar asignación ✓'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal Rechazar */}
      {showModalRechazo && reporteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={cerrarModal}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-slate-900">Rechazar reporte</h2>
                <button onClick={cerrarModal} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-400">✕</button>
              </div>
              <div className="flex gap-3 bg-slate-50 rounded-2xl p-3 border border-slate-200">
                <img src={reporteModal.foto_url} className="w-20 h-20 rounded-xl object-cover flex-shrink-0" alt="" />
                <div className="min-w-0">
                  <p className="text-sm text-slate-700 font-medium line-clamp-2">{reporteModal.descripcion}</p>
                  <p className="text-xs text-slate-500 mt-1">📍 {calleModal || 'Calculando...'}</p>
                </div>
              </div>
              <div className="bg-red-50 rounded-xl p-4 border border-red-100 flex gap-3">
                <span className="text-red-500 text-lg flex-shrink-0">⚠️</span>
                <p className="text-sm text-red-700">
                  El reporte quedará como <strong>descartado</strong> y desaparecerá permanentemente del mapa ciudadano. Esta acción no se puede deshacer.
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