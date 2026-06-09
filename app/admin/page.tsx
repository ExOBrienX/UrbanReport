'use client'

/**
 * app/admin/page.tsx — Panel de administración principal (SPA).
 *
 * Vista de página única: el sidebar cambia la vista activa sin recargar la página.
 * Todas las vistas del admin se renderizan aquí según el estado vistaActiva.
 *
 * Vistas disponibles:
 *   - dashboard    : KPIs y mapa general (RF-22, RF-23)
 *   - bandeja      : Revisión y aprobación de reportes (RF-17, RF-18)
 *   - incidencias  : Gestión y cancelación de tareas (RF-19, RF-22)
 *   - tecnicos     : CRUD de técnicos y especialidades (RF-20)
 *   - informe      : Generación de informe mensual con IA (RF-24)
 *   - configuracion: Ajuste de parámetros del sistema (RF-25)
 */

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useCallback } from 'react'
import dynamic from 'next/dynamic'
import AdminSidebar, { VistaAdmin } from './components/AdminSidebar'
import BandejaRevision from './components/BandejaRevision'
import GestionIncidencias from './components/GestionIncidencias'
import GestionTecnicos from './components/GestionTecnicos'
import InformeMensual from './components/InformeMensual'
import Configuracion from './components/Configuracion'

// Dashboard con carga dinámica — contiene Leaflet que no funciona en SSR
const AdminDashboard = dynamic(() => import('./components/AdminDashboard'), {
  ssr: false,
  loading: () => <div className="animate-pulse text-slate-400 p-8">Cargando dashboard...</div>
})

// Título de cada vista para el breadcrumb del header
const TITULOS: Record<VistaAdmin, string> = {
  dashboard:     'Dashboard general',
  bandeja:       'Bandeja de revisión',
  incidencias:   'Gestión de incidencias',
  tecnicos:      'Gestión de técnicos',
  informe:       'Generar informe mensual',
  configuracion: 'Configuración del sistema',
}

export default function AdminPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [vistaActiva, setVistaActiva] = useState<VistaAdmin>('dashboard')
  const [pendientesRevision, setPendientesRevision] = useState(0)

  // Redirigir si no está autenticado
  useEffect(() => {
    if (status === 'unauthenticated') router.push('/acceso')
  }, [status, router])

  /**
   * Obtiene el conteo de reportes pendientes de revisión para el badge del sidebar.
   * Se actualiza cada vez que se aprueba o rechaza un reporte desde la bandeja.
   */
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
        {/* Breadcrumb sticky */}
        <div className="sticky top-0 z-30 bg-white border-b border-slate-200 px-8 py-4">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <span>UrbanReport</span>
            <span>/</span>
            <span className="text-slate-900 font-medium">{TITULOS[vistaActiva]}</span>
          </div>
        </div>

        <div className="p-8">
          {vistaActiva === 'dashboard'     && <AdminDashboard />}
          {vistaActiva === 'bandeja'       && <BandejaRevision onActualizarPendientes={actualizarPendientes} />}
          {vistaActiva === 'incidencias'   && <GestionIncidencias />}
          {vistaActiva === 'tecnicos'      && <GestionTecnicos />}
          {vistaActiva === 'informe'       && <InformeMensual />}
          {vistaActiva === 'configuracion' && <Configuracion />}
        </div>
      </main>
    </div>
  )
}