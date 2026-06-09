/**
 * app/api/admin/tareas/route.ts
 * POST — Crear tarea urgente manual (RF-21) o asignar técnico a incidencia pendiente.
 * Solo accesible para usuarios con rol 'admin'.
 *
 * Body tarea urgente nueva:
 *   { categoriaId, latitud, longitud, descripcion, tecnicoId }
 *
 * Body asignar a incidencia existente:
 *   { incidenciaId, tecnicoId }
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../../lib/auth'
import { TareaService } from '../../../lib/services/TareaService'

const ERRORES: Record<string, { mensaje: string; status: number }> = {
  CATEGORIA_NO_ENCONTRADA:   { mensaje: 'Categoría no encontrada', status: 404 },
  TECNICO_NO_ENCONTRADO:     { mensaje: 'Técnico no encontrado', status: 404 },
  INCIDENCIA_NO_ENCONTRADA:  { mensaje: 'Incidencia no encontrada', status: 404 },
  YA_TIENE_TAREA_ACTIVA:     { mensaje: 'La incidencia ya tiene una tarea activa', status: 400 },
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (session.user.role !== 'admin') return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })

  const adminId = parseInt(session.user.id)
  const body = await request.json()
  const { incidenciaId, categoriaId, latitud, longitud, descripcion, tecnicoId } = body

  if (!tecnicoId) {
    return NextResponse.json({ error: 'tecnicoId es obligatorio' }, { status: 400 })
  }

  try {
    // Si viene incidenciaId → asignar técnico a incidencia existente (reasignación)
    if (incidenciaId) {
      const resultado = await TareaService.asignarAIncidenciaExistente(incidenciaId, tecnicoId, adminId)
      return NextResponse.json({ success: true, data: resultado }, { status: 201 })
    }

    // Si no → crear tarea urgente con nueva incidencia (RF-21)
    if (!categoriaId || !latitud || !longitud || !descripcion) {
      return NextResponse.json({ error: 'categoriaId, latitud, longitud y descripcion son obligatorios' }, { status: 400 })
    }

    const resultado = await TareaService.crearUrgente(categoriaId, latitud, longitud, descripcion, tecnicoId, adminId)
    return NextResponse.json({ success: true, data: resultado }, { status: 201 })

  } catch (error: any) {
    const err = ERRORES[error.message]
    if (err) return NextResponse.json({ error: err.mensaje }, { status: err.status })
    console.error('Error en POST /api/admin/tareas:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}