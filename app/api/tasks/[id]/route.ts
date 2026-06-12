/**
 * app/api/tasks/[id]/route.ts — Gestión de estado y evidencia de una tarea.
 * Solo accesible para usuarios con rol 'tecnico'.
 * Delega toda la lógica de negocio a TareaService (patrón Repository).
 *
 * PATCH /api/tasks/[id] — Cambia el estado de la tarea según la acción enviada.
 * POST  /api/tasks/[id] — Sube foto de evidencia y completa la tarea.
 *
 * Usado por: app/tecnico/components/TareaDetalleSheet.tsx
 * Depende de: TareaService, ResponseFactory, NextAuth
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../../lib/auth'
import { TareaService } from '../../../lib/services/TareaService'
import { ResponseFactory } from '../../../lib/factories/ResponseFactory'

const ERRORES: Record<string, { mensaje: string; status: number }> = {
  TAREA_NO_ENCONTRADA:       { mensaje: 'Tarea no encontrada', status: 404 },
  SIN_PERMISO:               { mensaje: 'No tienes permiso sobre esta tarea', status: 403 },
  TAREA_YA_ACEPTADA:         { mensaje: 'La tarea ya fue aceptada', status: 400 },
  YA_TIENE_TAREA_ACTIVA:     { mensaje: 'Ya tienes una tarea activa', status: 400 },
  DEBE_ACEPTAR_PRIMERO:      { mensaje: 'Debes aceptar la tarea primero', status: 400 },
  ESTADO_INVALIDO_ATRASO:    { mensaje: 'Solo puedes reportar atraso en tareas activas', status: 400 },
  MOTIVO_ATRASO_INVALIDO:    { mensaje: 'Debes seleccionar un motivo de atraso válido', status: 400 },
  ESTADO_INVALIDO_COMPLETAR: { mensaje: 'No puedes completar esta tarea en su estado actual', status: 400 },
  ACCION_INVALIDA:           { mensaje: 'Accion no reconocida', status: 400 },
  FOTO_DEMASIADO_GRANDE:     { mensaje: 'La foto no puede superar 8MB', status: 400 },
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) { const r = ResponseFactory.unauthorized(); return NextResponse.json(r.body, { status: r.status }) }
  if (session.user.role !== 'tecnico') { const r = ResponseFactory.forbidden(); return NextResponse.json(r.body, { status: r.status }) }

  const tecnicoId = parseInt(session.user.id)
  const { id } = await params
  const tareaId = parseInt(id)
  const body = await request.json()
  const { accion, motivo_atraso } = body

  const acciones = ['aceptar', 'iniciar', 'atraso', 'completar']
  if (!accion || !acciones.includes(accion)) {
    const r = ResponseFactory.validacion('Accion invalida')
    return NextResponse.json(r.body, { status: r.status })
  }

  try {
    const tarea = await TareaService.cambiarEstado(tareaId, tecnicoId, accion, motivo_atraso)
    const r = ResponseFactory.success({ tarea })
    return NextResponse.json(r.body, { status: r.status })
  } catch (error: any) {
    const r = ResponseFactory.serviceError(ERRORES, error.message)
    console.error('Error actualizando tarea:', error)
    return NextResponse.json(r.body, { status: r.status })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) { const r = ResponseFactory.unauthorized(); return NextResponse.json(r.body, { status: r.status }) }
  if (session.user.role !== 'tecnico') { const r = ResponseFactory.forbidden(); return NextResponse.json(r.body, { status: r.status }) }

  const tecnicoId = parseInt(session.user.id)
  const { id } = await params
  const tareaId = parseInt(id)
  const formData = await request.formData()
  const foto = formData.get('foto') as File | null

  if (!foto) {
    const r = ResponseFactory.validacion('La foto de evidencia es obligatoria')
    return NextResponse.json(r.body, { status: r.status })
  }

  const tiposPermitidos = ['image/jpeg', 'image/png', 'image/webp']
  if (!tiposPermitidos.includes(foto.type)) {
    const r = ResponseFactory.validacion('Solo se permiten imagenes JPG, PNG o WebP')
    return NextResponse.json(r.body, { status: r.status })
  }

  try {
    const { tarea, fotoUrl } = await TareaService.completarConEvidencia(tareaId, tecnicoId, foto)
    const r = ResponseFactory.success({ tarea, foto_url: fotoUrl })
    return NextResponse.json(r.body, { status: r.status })
  } catch (error: any) {
    const r = ResponseFactory.serviceError(ERRORES, error.message)
    console.error('Error subiendo evidencia:', error)
    return NextResponse.json(r.body, { status: r.status })
  }
}