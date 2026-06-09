'use client'

/**
 * app/tecnico/page.tsx — Panel principal del tecnico municipal (SPA mobile-first).
 *
 * Vista unica que muestra la cola de tareas disponibles y el estado de la
 * tarea activa del tecnico autenticado. Disenada para usarse en terreno
 * desde un dispositivo movil.
 *
 * Logica de tareas:
 *   - Tarea activa: tarea propia en estado aceptada, en_curso o atrasada.
 *                   Se muestra en un banner destacado al inicio.
 *   - Tareas disponibles: tareas sin tecnico asignado (estado 'asignada')
 *                         de las especialidades del tecnico. Se muestran
 *                         en la cola para ser aceptadas.
 *
 * Flujo de acciones:
 *   Aceptar  → PATCH /api/tasks/[id] { accion: 'aceptar' }
 *   Iniciar  → PATCH /api/tasks/[id] { accion: 'iniciar' }
 *   Atraso   → PATCH /api/tasks/[id] { accion: 'atraso', motivo_atraso }
 *   Completar → POST /api/tasks/[id] (multipart con foto de evidencia)
 *
 * Modales auxiliares:
 *   TareaDetalleSheet — detalle completo de una tarea con acciones
 *   AtrasoModal       — selector de motivo de atraso
 *   EvidenciaModal    — camara para foto de evidencia al completar
 *
 * Usado por: Next.js router — ruta /tecnico
 * Depende de: TareaCard, TareaDetalleSheet, AtrasoModal, EvidenciaModal,
 *             GET /api/tasks, PATCH /api/tasks/[id], POST /api/tasks/[id]
 */

import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useCallback } from 'react'
import TareaCard, { Tarea } from './components/Tareacard'
import TareaDetalleSheet from './components/Tareadetallesheet'
import AtrasoModal from './components/Atrasomodal'
import EvidenciaModal from './components/Evidenciamodal'

export default function TecnicoPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [tareas, setTareas] = useState<Tarea[]>([])
  const [loading, setLoading] = useState(true)
  const [accionando, setAccionando] = useState(false) // true mientras se procesa una accion
  const [tareaSeleccionada, setTareaSeleccionada] = useState<Tarea | null>(null)
  const [showDetalle, setShowDetalle] = useState(false)
  const [showAtraso, setShowAtraso] = useState(false)
  const [showEvidencia, setShowEvidencia] = useState(false)
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)

  const tecnicoId = parseInt(session?.user?.id ?? '0')

  // Redirigir al acceso si la sesion expira o el usuario no esta autenticado
  useEffect(() => {
    if (status === 'unauthenticated') router.push('/acceso')
  }, [status, router])

  /**
   * Carga la cola de tareas del tecnico desde el backend.
   * Incluye tareas disponibles de su especialidad y su tarea activa propia.
   */
  const cargarTareas = useCallback(async () => {
    try {
      const res = await fetch('/api/tasks')
      const data = await res.json()
      if (data.success) setTareas(data.tareas)
    } catch {
      mostrarMensaje('error', 'Error cargando tareas')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (status === 'authenticated') cargarTareas()
  }, [status, cargarTareas])

  const mostrarMensaje = (tipo: 'ok' | 'error', texto: string) => {
    setMensaje({ tipo, texto })
    setTimeout(() => setMensaje(null), 4000)
  }

  /**
   * Ejecuta una accion de estado sobre una tarea via PATCH.
   * Retorna true si la accion fue exitosa, false si hubo error.
   * extra permite enviar campos adicionales como motivo_atraso.
   */
  const ejecutarAccion = async (tareaId: number, accion: string, extra?: Record<string, string>) => {
    setAccionando(true)
    try {
      const res = await fetch(`/api/tasks/${tareaId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion, ...extra })
      })
      const data = await res.json()
      if (!res.ok) { mostrarMensaje('error', data.error); return false }
      mostrarMensaje('ok', mensajeAccion(accion))
      await cargarTareas()
      return true
    } catch {
      mostrarMensaje('error', 'Error de conexion')
      return false
    } finally {
      setAccionando(false)
    }
  }

  // Mensaje de confirmacion por tipo de accion
  const mensajeAccion = (accion: string) => {
    const msgs: Record<string, string> = {
      aceptar:  'Tarea aceptada correctamente',
      iniciar:  'Trabajo iniciado',
      atraso:   'Atraso reportado',
      completar: 'Tarea completada'
    }
    return msgs[accion] ?? 'Accion realizada'
  }

  /**
   * Sube la foto de evidencia como multipart y completa la tarea.
   * Convierte el dataURL de la camara a un File antes de enviarlo.
   */
  const subirEvidencia = async (tareaId: number, fotoDataUrl: string) => {
    setAccionando(true)
    try {
      const blob = await (await fetch(fotoDataUrl)).blob()
      const fotoFile = new File([blob], 'evidencia.jpg', { type: 'image/jpeg' })
      const formData = new FormData()
      formData.append('foto', fotoFile)

      const res = await fetch(`/api/tasks/${tareaId}`, { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok) { mostrarMensaje('error', data.error); return }
      mostrarMensaje('ok', 'Tarea completada con evidencia')
      setShowEvidencia(false)
      setShowDetalle(false)
      setTareaSeleccionada(null)
      await cargarTareas()
    } catch {
      mostrarMensaje('error', 'Error subiendo evidencia')
    } finally {
      setAccionando(false)
    }
  }

  // Tarea propia activa — el tecnico solo puede tener una a la vez
  const tareaActiva = tareas.find(t =>
    t.tecnico_id === tecnicoId &&
    ['aceptada', 'en_curso', 'atrasada'].includes(t.estado)
  )

  // Tareas sin tecnico asignado disponibles para aceptar
  const tareasDisponibles = tareas.filter(t => t.estado === 'asignada')

  const abrirDetalle = (tarea: Tarea) => {
    setTareaSeleccionada(tarea)
    setShowDetalle(true)
  }

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <p className="text-sm text-slate-400">Cargando...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">

      {/* Header con nombre del tecnico y boton de cierre de sesion */}
      <div className="px-5 pt-12 pb-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-slate-400">Bienvenido,</p>
            <h1 className="text-2xl font-bold text-white">{session?.user?.nombre}</h1>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: '/acceso' })}
            className="mt-1 border border-slate-700 rounded-xl px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
          >
            Salir
          </button>
        </div>
      </div>

      {/* Mensaje de confirmacion o error de acciones */}
      {mensaje && (
        <div className={`mx-5 mb-3 rounded-2xl px-4 py-3 text-sm font-medium ${
          mensaje.tipo === 'ok'
            ? 'bg-green-900/50 text-green-300 border border-green-800'
            : 'bg-red-900/50 text-red-300 border border-red-800'
        }`}>
          {mensaje.texto}
        </div>
      )}

      {/* Banner de tarea activa — pulsa para ver el detalle */}
      {tareaActiva && (
        <div
          className="mx-5 mb-4 rounded-2xl bg-blue-600/20 border border-blue-500/30 px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-blue-600/30 transition-colors"
          onClick={() => abrirDetalle(tareaActiva)}
        >
          <div className="flex items-center gap-2">
            {/* Punto animado indica que hay trabajo en progreso */}
            <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
            <p className="text-sm text-blue-300 font-medium">
              {tareaActiva.estado === 'en_curso' ? 'Tarea en curso' :
               tareaActiva.estado === 'atrasada' ? 'Tarea con atraso' : 'Tarea aceptada'}
            </p>
          </div>
          <span className="text-blue-400 text-xs">Ver</span>
        </div>
      )}

      {/* Cola de tareas disponibles */}
      <div className="px-5 pb-8 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide">
            {tareasDisponibles.length} tarea{tareasDisponibles.length !== 1 ? 's' : ''} pendiente{tareasDisponibles.length !== 1 ? 's' : ''}
          </h2>
          <button onClick={cargarTareas} className="text-xs text-slate-500 hover:text-slate-300">
            Actualizar
          </button>
        </div>

        {tareasDisponibles.length === 0 && !tareaActiva ? (
          <div className="text-center py-16 space-y-2">
            <p className="text-slate-400 text-sm">No hay tareas disponibles</p>
          </div>
        ) : (
          tareasDisponibles.map(tarea => (
            <TareaCard
              key={tarea.id}
              tarea={tarea}
              tecnicoId={tecnicoId}
              onVerDetalle={abrirDetalle}
              onAceptar={async (id) => {
                const ok = await ejecutarAccion(id, 'aceptar')
                if (ok) setShowDetalle(false)
              }}
              accionando={accionando}
            />
          ))
        )}
      </div>

      {/* Sheet de detalle — acciones segun estado de la tarea */}
      {showDetalle && tareaSeleccionada && (
        <TareaDetalleSheet
          tarea={tareaSeleccionada}
          tecnicoId={tecnicoId}
          onCerrar={() => { setShowDetalle(false); setTareaSeleccionada(null) }}
          onAceptar={async () => {
            const ok = await ejecutarAccion(tareaSeleccionada.id, 'aceptar')
            if (ok) setShowDetalle(false)
          }}
          onIniciar={async () => {
            const ok = await ejecutarAccion(tareaSeleccionada.id, 'iniciar')
            if (ok) setShowDetalle(false)
          }}
          onAtraso={() => setShowAtraso(true)}
          onCompletar={() => setShowEvidencia(true)}
          accionando={accionando}
        />
      )}

      {/* Modal para reportar motivo de atraso */}
      {showAtraso && tareaSeleccionada && (
        <AtrasoModal
          onConfirmar={async (motivo) => {
            const ok = await ejecutarAccion(tareaSeleccionada.id, 'atraso', { motivo_atraso: motivo })
            if (ok) { setShowAtraso(false); setShowDetalle(false) }
          }}
          onCancelar={() => setShowAtraso(false)}
          accionando={accionando}
        />
      )}

      {/* Modal para capturar foto de evidencia al completar */}
      {showEvidencia && tareaSeleccionada && (
        <EvidenciaModal
          onConfirmar={(foto) => subirEvidencia(tareaSeleccionada.id, foto)}
          onCancelar={() => setShowEvidencia(false)}
          accionando={accionando}
        />
      )}
    </div>
  )
}