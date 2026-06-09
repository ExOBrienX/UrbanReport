/**
 * app/api/admin/tareas/[id]/route.ts — Cancelacion de tareas activas por el admin (RF-19).
 * Solo accesible para usuarios con rol 'admin'.
 * Delega la logica de negocio a TareaService (patron Repository).
 *
 * PATCH /api/admin/tareas/[id] — cancela una tarea activa con motivo obligatorio.
 *   El motivo queda registrado en la tarea para trazabilidad.
 *   La incidencia asociada vuelve a estado 'pendiente' para ser reasignada.
 *
 * Solo se pueden cancelar tareas en estado: asignada, aceptada, en_curso, atrasada.
 * Las tareas completadas o ya canceladas no son cancelables.
 *
 * Usado por: app/admin/components/GestionIncidencias.tsx (modal cancelar tarea)
 * Depende de: TareaService, NextAuth
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../../../lib/auth'
import { TareaService } from '../../../../lib/services/TareaService'

// Traduccion de errores del servicio a mensajes legibles para el cliente
const ERRORES: Record<string, { mensaje: string; status: number }> = {
  TAREA_NO_ENCONTRADA:          { mensaje: 'Tarea no encontrada', status: 404 },
  TAREA_NO_CANCELABLE:          { mensaje: 'Solo se pueden cancelar tareas activas', status: 400 },
  MOTIVO_CANCELACION_REQUERIDO: { mensaje: 'El motivo de cancelacion es obligatorio', status: 400 },
}

// PATCH /api/admin/tareas/[id] — cancelar tarea con motivo obligatorio
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (session.user.role !== 'admin') return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })

  const adminId = parseInt(session.user.id)
  const { id } = await params
  const tareaId = parseInt(id)
  const body = await request.json()
  const { motivoCancelacion } = body

  // Validar motivo en el route antes de llamar al servicio
  if (!motivoCancelacion?.trim()) {
    return NextResponse.json(
      { error: 'El motivo de cancelacion es obligatorio' },
      { status: 400 }
    )
  }

  try {
    // El servicio verifica el estado de la tarea y registra el adminId para trazabilidad
    const tarea = await TareaService.cancelar(tareaId, adminId, motivoCancelacion)
    return NextResponse.json({ success: true, tarea }, { status: 200 })
  } catch (error: any) {
    const err = ERRORES[error.message]
    if (err) return NextResponse.json({ error: err.mensaje }, { status: err.status })
    console.error('Error cancelando tarea:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}