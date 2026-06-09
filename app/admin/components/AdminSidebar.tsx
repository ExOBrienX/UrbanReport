'use client'

/**
 * AdminSidebar.tsx — Barra lateral de navegacion del panel admin.
 *
 * Sidebar fijo que permite cambiar entre las vistas del panel SPA sin recargar
 * la pagina. Muestra un badge rojo en la opcion "Bandeja de revision" cuando
 * hay reportes pendientes de aprobacion, para alertar al admin sin que tenga
 * que entrar a la vista.
 *
 * El badge se actualiza desde AdminPage via prop pendientesRevision, que se
 * recalcula cada vez que el admin aprueba o rechaza un reporte en BandejaRevision.
 *
 * Usado por: app/admin/page.tsx
 * Depende de: next-auth/react (signOut)
 */

import { signOut } from 'next-auth/react'

// Tipo union de todas las vistas disponibles en el panel admin
export type VistaAdmin =
  | 'dashboard'
  | 'bandeja'
  | 'incidencias'
  | 'tecnicos'
  | 'informe'
  | 'configuracion'

interface AdminSidebarProps {
  vistaActiva: VistaAdmin
  onCambiarVista: (vista: VistaAdmin) => void
  nombreAdmin: string
  pendientesRevision: number // conteo de reportes en bandeja — activa el badge si > 0
}

// Items del menu con sus iconos y IDs correspondientes a VistaAdmin
const MENU_ITEMS: { id: VistaAdmin; label: string; icon: string }[] = [
  { id: 'dashboard',     label: 'Dashboard',           icon: '⊞' },
  { id: 'bandeja',       label: 'Bandeja de revision',  icon: '◉' },
  { id: 'incidencias',   label: 'Incidencias',          icon: '📍' },
  { id: 'tecnicos',      label: 'Tecnicos',             icon: '👥' },
  { id: 'informe',       label: 'Generar informe',      icon: '📊' },
  { id: 'configuracion', label: 'Configuracion',        icon: '⚙' },
]

export default function AdminSidebar({ vistaActiva, onCambiarVista, nombreAdmin, pendientesRevision }: AdminSidebarProps) {
  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-slate-900 flex flex-col z-40 border-r border-slate-700/50">
      {/* Logo y nombre del sistema */}
      <div className="px-6 py-5 border-b border-slate-700/50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center text-slate-900 font-bold text-sm">UR</div>
          <div>
            <p className="text-white font-semibold text-sm">UrbanReport</p>
            <p className="text-slate-400 text-xs">Panel Administrador</p>
          </div>
        </div>
      </div>

      {/* Items de navegacion */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {MENU_ITEMS.map((item) => {
          const isActive   = vistaActiva === item.id
          // Badge solo en bandeja y solo cuando hay reportes pendientes
          const showBadge  = item.id === 'bandeja' && pendientesRevision > 0
          return (
            <button
              key={item.id}
              onClick={() => onCambiarVista(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                isActive ? 'bg-white text-slate-900' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <span className="text-base">{item.icon}</span>
              <span className="flex-1 text-left">{item.label}</span>
              {/* Badge con conteo — trunca a 99+ si supera ese valor */}
              {showBadge && (
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-500 text-white">
                  {pendientesRevision > 99 ? '99+' : pendientesRevision}
                </span>
              )}
            </button>
          )
        })}
      </nav>

      {/* Perfil del admin y boton de cierre de sesion */}
      <div className="px-4 py-4 border-t border-slate-700/50">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-white text-xs font-bold">
            {nombreAdmin.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-white text-xs font-medium truncate">{nombreAdmin}</p>
            <p className="text-slate-500 text-xs">Administrador</p>
          </div>
        </div>
        {/* signOut redirige a /acceso para que el middleware no cachee la sesion */}
        <button
          onClick={() => signOut({ callbackUrl: '/acceso' })}
          className="w-full text-left text-xs text-slate-500 hover:text-slate-300 transition-colors px-1"
        >
          Cerrar sesion
        </button>
      </div>
    </aside>
  )
}