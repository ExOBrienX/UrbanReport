/**
 * app/api/admin/tareas/[id]/route.ts — Cancelacion de tareas activas (RF-19).
 * Depende de: TareaService, ResponseFactory, NextAuth
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../../../lib/auth'
import { TareaService } from '../../../../lib/services/TareaService'
import { ResponseFactory } from '../../../../lib/factories/ResponseFactory'

const ERRORES: Record<string, { mensaje: string; status: number }> = {
  TAREA_NO_ENCONTRADA:          { mensaje: 'Tarea no encontrada', status: 404 },
  TAREA_NO_CANCELABLE:          { mensaje: 'Solo se pueden cancelar tareas activas', status: 400 },
  MOTIVO_CANCELACION_REQUERIDO: { mensaje: 'El motivo de cancelacion es obligatorio', status: 400 },
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) { const r = ResponseFactory.unauthorized(); return NextResponse.json(r.body, { status: r.status }) }
  if (session.user.role !== 'admin') { const r = ResponseFactory.forbidden(); return NextResponse.json(r.body, { status: r.status }) }

  const adminId = parseInt(session.user.id)
  const { id } = await params
  const tareaId = parseInt(id)
  const body = await request.json()
  const { motivoCancelacion } = body

  if (!motivoCancelacion?.trim()) {
    const r = ResponseFactory.validacion('El motivo de cancelacion es obligatorio')
    return NextResponse.json(r.body, { status: r.status })
  }

  try {
    const tarea = await TareaService.cancelar(tareaId, adminId, motivoCancelacion)
    const r = ResponseFactory.success({ tarea })
    return NextResponse.json(r.body, { status: r.status })
  } catch (error: any) {
    const r = ResponseFactory.serviceError(ERRORES, error.message)
    console.error('Error cancelando tarea:', error)
    return NextResponse.json(r.body, { status: r.status })
  }
}