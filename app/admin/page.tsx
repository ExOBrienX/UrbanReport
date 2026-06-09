'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useCallback } from 'react'
import dynamic from 'next/dynamic'
import AdminSidebar, { VistaAdmin } from './components/AdminSidebar'
import BandejaRevision from './components/BandejaRevision'
import GestionIncidencias from './components/GestionIncidencias'

const AdminDashboard = dynamic(() => import('./components/AdminDashboard'), {
  ssr: false,
  loading: () => <div className="animate-pulse text-slate-400 p-8">Cargando dashboard...</div>
})

function VistaPendiente({ nombre }: { nombre: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-64 space-y-3">
      <p className="text-4xl">:construction:</p>
      <p className="text-slate-600 font-medium">{nombre}</p>
      <p className="text-slate-400 text-sm">En construcción — próxima issue</p>
    </div>
  )
}

const TITULOS: Record<VistaAdmin, string> = {
  dashboard:       'Dashboard general',
  bandeja:         'Bandeja de revisión',
  incidencias:     'Gestión de incidencias',
  tecnicos:        'Gestión de técnicos',
  'tarea-urgente': 'Insertar tarea urgente',
  informe:         'Generar informe mensual',
  configuracion:   'Configuración del sistema',
}

export default function AdminPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [vistaActiva, setVistaActiva] = useState<VistaAdmin>('dashboard')
  const [pendientesRevision, setPendientesRevision] = useState(0)

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/acceso')
  }, [status, router])

  const actualizarPendientes = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/dashboard')
      const data = await res.json()
      if (data.success) setPendientesRevision(data.kpis.reportesPendientesRevision)
    } catch {}
  }, [])

  useEffect(() => {
    if (status === 'authenticated') actualizarPendientes()
  }, [status, actualizarPendientes])

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-slate-400 text-sm animate-pulse">Cargando...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <AdminSidebar
        vistaActiva={vistaActiva}
        onCambiarVista={setVistaActiva}
        nombreAdmin={session?.user?.nombre ?? 'Admin'}
        pendientesRevision={pendientesRevision}
      />

      <main className="ml-64 flex-1 min-h-screen">
        <div className="sticky top-0 z-30 bg-white border-b border-slate-200 px-8 py-4">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <span>UrbanReport</span>
            <span>/</span>
            <span className="text-slate-900 font-medium">{TITULOS[vistaActiva]}</span>
          </div>
        </div>

        <div className="p-8">
          {vistaActiva === 'dashboard'    && <AdminDashboard />}
          {vistaActiva === 'bandeja'      && <BandejaRevision onActualizarPendientes={actualizarPendientes} />}
          {vistaActiva === 'incidencias'  && <GestionIncidencias />}
          {vistaActiva === 'tecnicos'     && <VistaPendiente nombre="Gestión de técnicos" />}
          {vistaActiva === 'tarea-urgente'&& <VistaPendiente nombre="Tarea urgente" />}
          {vistaActiva === 'informe'      && <VistaPendiente nombre="Informe mensual" />}
          {vistaActiva === 'configuracion'&& <VistaPendiente nombre="Configuración" />}
        </div>
      </main>
    </div>
  )
}