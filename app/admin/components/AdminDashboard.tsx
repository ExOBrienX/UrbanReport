'use client'

import { useEffect, useState, useCallback } from 'react'
import dynamic from 'next/dynamic'

const AdminMap = dynamic(() => import('./AdminMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-slate-100">
      <p className="text-slate-400 text-sm animate-pulse">Cargando mapa...</p>
    </div>
  )
})

interface KPIs {
  resumenIncidencias: { pendiente: number; asignado: number; enCurso: number; completado: number; total: number }
  reportesPendientesRevision: number
  mes: { periodo: string; totalIncidencias: number; completadas: number; tasaResolucion: number; tareasCompletadas: number }
  porCategoria: { nombre: string; incidenciasActivas: number; peligrosidad: number }[]
  rankingTecnicos: { id: number; nombre: string; tareasCompletadasMes: number }[]
  tiemposResolucion: { categoria: string; promedioHoras: number; totalCompletadas: number }[]
}

export default function AdminDashboard() {
  const [kpis, setKpis] = useState<KPIs | null>(null)
  const [loading, setLoading] = useState(true)

  const cargarKPIs = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/dashboard')
      const data = await res.json()
      if (data.success) setKpis(data.kpis)
    } catch {
      console.error('Error cargando KPIs')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { cargarKPIs() }, [cargarKPIs])

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="grid grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="h-28 bg-slate-200 rounded-2xl" />)}
        </div>
        <div className="h-96 bg-slate-200 rounded-2xl" />
      </div>
    )
  }

  if (!kpis) return null

  const activas = kpis.resumenIncidencias.total - kpis.resumenIncidencias.completado

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard general</h1>
          <p className="text-slate-500 text-sm mt-0.5">Período: {kpis.mes.periodo}</p>
        </div>
        <button onClick={cargarKPIs} className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-900 border border-slate-200 hover:border-slate-400 rounded-xl px-4 py-2 transition-all">
          ↻ Actualizar
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-5 hover:shadow-md transition-shadow group">
          <div className="flex items-start justify-between mb-3">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Incidencias activas</p>
            <span className="text-lg">📍</span>
          </div>
          <p className="text-4xl font-black text-slate-900 group-hover:scale-105 transition-transform origin-left">{activas}</p>
          <p className="text-xs text-slate-400 mt-2">de {kpis.resumenIncidencias.total} totales</p>
          <div className="mt-3 h-1 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-slate-900 rounded-full" style={{ width: `${kpis.resumenIncidencias.total > 0 ? (activas / kpis.resumenIncidencias.total) * 100 : 0}%` }} />
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 hover:shadow-md transition-shadow group">
          <div className="flex items-start justify-between mb-3">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Tasa resolución</p>
            <span className="text-lg">📈</span>
          </div>
          <p className={`text-4xl font-black group-hover:scale-105 transition-transform origin-left ${kpis.mes.tasaResolucion >= 70 ? 'text-green-600' : kpis.mes.tasaResolucion >= 40 ? 'text-amber-500' : 'text-slate-900'}`}>
            {kpis.mes.tasaResolucion}%
          </p>
          <p className="text-xs text-slate-400 mt-2">este mes</p>
          <div className="mt-3 h-1 bg-slate-100 rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${kpis.mes.tasaResolucion >= 70 ? 'bg-green-500' : kpis.mes.tasaResolucion >= 40 ? 'bg-amber-500' : 'bg-slate-400'}`}
              style={{ width: `${kpis.mes.tasaResolucion}%` }} />
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 hover:shadow-md transition-shadow group">
          <div className="flex items-start justify-between mb-3">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Tareas completadas</p>
            <span className="text-lg">✅</span>
          </div>
          <p className="text-4xl font-black text-slate-900 group-hover:scale-105 transition-transform origin-left">{kpis.mes.tareasCompletadas}</p>
          <p className="text-xs text-slate-400 mt-2">en el mes</p>
        </div>

        <div className={`rounded-2xl border p-5 hover:shadow-md transition-shadow group ${kpis.reportesPendientesRevision > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-slate-200'}`}>
          <div className="flex items-start justify-between mb-3">
            <p className={`text-xs font-semibold uppercase tracking-wider ${kpis.reportesPendientesRevision > 0 ? 'text-red-400' : 'text-slate-400'}`}>
              Pendientes revisión
            </p>
            <span className="text-lg">{kpis.reportesPendientesRevision > 0 ? '🔴' : '✓'}</span>
          </div>
          <p className={`text-4xl font-black group-hover:scale-105 transition-transform origin-left ${kpis.reportesPendientesRevision > 0 ? 'text-red-600' : 'text-slate-900'}`}>
            {kpis.reportesPendientesRevision}
          </p>
          <p className={`text-xs mt-2 ${kpis.reportesPendientesRevision > 0 ? 'text-red-400' : 'text-slate-400'}`}>
            {kpis.reportesPendientesRevision > 0 ? 'requieren acción' : 'al día'}
          </p>
        </div>
      </div>

      {/* Layout mapa + panel lateral */}
      <div className="grid grid-cols-3 gap-4">
        {/* Mapa — ocupa 2/3 y llega hasta el final */}
        <div className="col-span-2 bg-white rounded-2xl border border-slate-200 overflow-hidden flex flex-col" style={{ minHeight: '700px', height: 'calc(100vh - 340px)' }}>
          <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
            <p className="text-sm font-semibold text-slate-900">Mapa de incidencias activas</p>
            <div className="flex items-center gap-3 text-xs text-slate-500">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block"/>Sin asignar</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500 inline-block"/>Asignado</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-500 inline-block"/>En curso</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block"/>Completado</span>
            </div>
          </div>
          <div className="flex-1">
            <AdminMap />
          </div>
        </div>

        {/* Panel derecho */}
        <div className="space-y-4">
          {/* Estados */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Por estado</p>
            <div className="space-y-3">
              {[
                { label: 'Sin asignar', color: 'bg-red-500',   val: kpis.resumenIncidencias.pendiente },
                { label: 'Asignado',    color: 'bg-blue-500',  val: kpis.resumenIncidencias.asignado },
                { label: 'En curso',    color: 'bg-amber-500', val: kpis.resumenIncidencias.enCurso },
                { label: 'Completado',  color: 'bg-green-500', val: kpis.resumenIncidencias.completado },
              ].map(item => (
                <div key={item.label} className="flex items-center gap-3">
                  <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${item.color}`} />
                  <span className="text-sm text-slate-600 flex-1">{item.label}</span>
                  <span className="text-sm font-bold text-slate-900">{item.val}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Ranking técnicos */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Técnicos del mes</p>
            <div className="space-y-3">
              {kpis.rankingTecnicos.slice(0, 5).map((t, i) => (
                <div key={t.id} className="flex items-center gap-3">
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${i === 0 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>
                    {i + 1}
                  </span>
                  <span className="text-sm text-slate-700 flex-1 truncate">{t.nombre}</span>
                  <span className="text-sm font-bold text-slate-900">{t.tareasCompletadasMes}</span>
                </div>
              ))}
              {kpis.rankingTecnicos.length === 0 && (
                <p className="text-xs text-slate-400 text-center py-2">Sin datos este mes</p>
              )}
            </div>
          </div>

          {/* Por categoría */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Por categoría</p>
            <div className="space-y-2">
              {kpis.porCategoria.map((c) => {
                const max = Math.max(...kpis.porCategoria.map(x => x.incidenciasActivas), 1)
                return (
                  <div key={c.nombre}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-slate-600">{c.nombre}</span>
                      <span className="text-xs font-bold text-slate-900">{c.incidenciasActivas}</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-slate-900 rounded-full" style={{ width: `${(c.incidenciasActivas / max) * 100}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}