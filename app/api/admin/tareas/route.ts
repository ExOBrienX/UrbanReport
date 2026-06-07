/**
 * app/api/admin/tareas/route.ts
 * POST — Crear tarea urgente manual (RF-21).
 * Solo accesible para usuarios con rol 'admin'.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../../lib/auth'
import { TareaService } from '../../../lib/services/TareaService'

const ERRORES: Record<string, { mensaje: string; status: number }> = {
  CATEGORIA_NO_ENCONTRADA: { mensaje: 'Categoría no encontrada', status: 404 },
  TECNICO_NO_ENCONTRADO:   { mensaje: 'Técnico no encontrado', status: 404 },
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (session.user.role !== 'admin') return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })

  const adminId = parseInt(session.user.id)
  const body = await request.json()
  const { categoriaId, latitud, longitud, descripcion, tecnicoId } = body

  if (!categoriaId || !latitud || !longitud || !descripcion || !tecnicoId) {
    return NextResponse.json({ error: 'Todos los campos son obligatorios' }, { status: 400 })
  }

  try {
    const resultado = await TareaService.crearUrgente(
      categoriaId, latitud, longitud, descripcion, tecnicoId, adminId
    )
    return NextResponse.json({ success: true, data: resultado }, { status: 201 })
  } catch (error: any) {
    const err = ERRORES[error.message]
    if (err) return NextResponse.json({ error: err.mensaje }, { status: err.status })
    console.error('Error creando tarea urgente:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}