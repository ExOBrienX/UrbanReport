/**
 * app/api/admin/tareas/[id]/route.ts
 * PATCH — Cancelar una tarea activa (RF-19).
 * Solo accesible para usuarios con rol 'admin'.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../../../lib/auth'
import { TareaService } from '../../../../lib/services/TareaService'

const ERRORES: Record<string, { mensaje: string; status: number }> = {
  TAREA_NO_ENCONTRADA:        { mensaje: 'Tarea no encontrada', status: 404 },
  TAREA_NO_CANCELABLE:        { mensaje: 'Solo se pueden cancelar tareas activas', status: 400 },
  MOTIVO_CANCELACION_REQUERIDO: { mensaje: 'El motivo de cancelación es obligatorio', status: 400 },
}

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

  if (!motivoCancelacion?.trim()) {
    return NextResponse.json({ error: 'El motivo de cancelación es obligatorio' }, { status: 400 })
  }

  try {
    const tarea = await TareaService.cancelar(tareaId, adminId, motivoCancelacion)
    return NextResponse.json({ success: true, tarea }, { status: 200 })
  } catch (error: any) {
    const err = ERRORES[error.message]
    if (err) return NextResponse.json({ error: err.mensaje }, { status: err.status })
    console.error('Error cancelando tarea:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}