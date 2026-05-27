/**
 * app/api/tasks/[id]/route.ts — Gestión de estado y evidencia de una tarea.
 * Solo accesible para usuarios con rol 'tecnico'.
 * Delega toda la lógica de negocio a TareaService (patrón Repository).
 *
 * PATCH /api/tasks/[id] — Cambia el estado según la acción enviada
 * POST  /api/tasks/[id] — Sube foto de evidencia y completa la tarea
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../../lib/auth'
import { TareaService } from '../../../lib/services/Tareaservice'

// Mapa de errores del servicio a mensajes y códigos HTTP para el cliente
const ERRORES: Record<string, { mensaje: string; status: number }> = {
  TAREA_NO_ENCONTRADA:     { mensaje: 'Tarea no encontrada', status: 404 },
  SIN_PERMISO:             { mensaje: 'No tienes permiso sobre esta tarea', status: 403 },
  TAREA_YA_ACEPTADA:       { mensaje: 'La tarea ya fue aceptada', status: 400 },
  YA_TIENE_TAREA_ACTIVA:   { mensaje: 'Ya tienes una tarea activa', status: 400 },
  DEBE_ACEPTAR_PRIMERO:    { mensaje: 'Debes aceptar la tarea primero', status: 400 },
  ESTADO_INVALIDO_ATRASO:  { mensaje: 'Solo puedes reportar atraso en tareas activas', status: 400 },
  MOTIVO_ATRASO_INVALIDO:  { mensaje: 'Debes seleccionar un motivo de atraso válido', status: 400 },
  ESTADO_INVALIDO_COMPLETAR: { mensaje: 'No puedes completar esta tarea en su estado actual', status: 400 },
  ACCION_INVALIDA:         { mensaje: 'Acción no reconocida', status: 400 },
  FOTO_DEMASIADO_GRANDE:   { mensaje: 'La foto no puede superar 8MB', status: 400 },
}

// PATCH /api/tasks/[id] — cambiar estado de una tarea
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)

  if (!session) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
  if (session.user.role !== 'tecnico') {
    return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })
  }

  const tecnicoId = parseInt(session.user.id)
  const { id } = await params
  const tareaId = parseInt(id)
  const body = await request.json()
  const { accion, motivo_atraso } = body

  // Validar acción antes de llamar al servicio
  const acciones = ['aceptar', 'iniciar', 'atraso', 'completar']
  if (!accion || !acciones.includes(accion)) {
    return NextResponse.json({ error: 'Acción inválida' }, { status: 400 })
  }

  try {
    // Delegar toda la lógica de negocio al TareaService
    const tarea = await TareaService.cambiarEstado(tareaId, tecnicoId, accion, motivo_atraso)
    return NextResponse.json({ success: true, tarea }, { status: 200 })
  } catch (error: any) {
    // Traducir errores semánticos del servicio a respuestas HTTP
    const err = ERRORES[error.message]
    if (err) return NextResponse.json({ error: err.mensaje }, { status: err.status })

    console.error('Error actualizando tarea:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

// POST /api/tasks/[id] — subir foto de evidencia y completar la tarea
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)

  if (!session) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
  if (session.user.role !== 'tecnico') {
    return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })
  }

  const tecnicoId = parseInt(session.user.id)
  const { id } = await params
  const tareaId = parseInt(id)

  const formData = await request.formData()
  const foto = formData.get('foto') as File | null

  if (!foto) {
    return NextResponse.json({ error: 'La foto de evidencia es obligatoria' }, { status: 400 })
  }

  // Validar tipo de archivo antes de llamar al servicio
  const tiposPermitidos = ['image/jpeg', 'image/png', 'image/webp']
  if (!tiposPermitidos.includes(foto.type)) {
    return NextResponse.json({ error: 'Solo se permiten imágenes JPG, PNG o WebP' }, { status: 400 })
  }

  try {
    // Delegar la lógica de completar con evidencia al TareaService
    const { tarea, fotoUrl } = await TareaService.completarConEvidencia(tareaId, tecnicoId, foto)
    return NextResponse.json({ success: true, tarea, foto_url: fotoUrl }, { status: 200 })
  } catch (error: any) {
    const err = ERRORES[error.message]
    if (err) return NextResponse.json({ error: err.mensaje }, { status: err.status })

    console.error('Error subiendo evidencia:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}