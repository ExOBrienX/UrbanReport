/**
 * app/api/admin/tareas/route.ts — Creacion de tareas por el administrador.
 * Solo accesible para usuarios con rol 'admin'.
 * Delega la logica de negocio a TareaService (patron Repository).
 *
 * POST /api/admin/tareas — opera en dos modos segun el body recibido:
 *
 *   Modo 1 — Reasignar tecnico a incidencia existente (incidencia pendiente sin tecnico):
 *     { incidenciaId, tecnicoId }
 *
 *   Modo 2 — Crear tarea urgente con nueva incidencia (RF-21):
 *     { categoriaId, latitud, longitud, descripcion, tecnicoId }
 *
 * Usado por: app/admin/components/GestionIncidencias.tsx (modal asignar tecnico)
 * Depende de: TareaService, NextAuth
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../../lib/auth'
import { TareaService } from '../../../lib/services/TareaService'

// Traduccion de errores del servicio a mensajes legibles para el cliente
const ERRORES: Record<string, { mensaje: string; status: number }> = {
  CATEGORIA_NO_ENCONTRADA:  { mensaje: 'Categoria no encontrada', status: 404 },
  TECNICO_NO_ENCONTRADO:    { mensaje: 'Tecnico no encontrado', status: 404 },
  INCIDENCIA_NO_ENCONTRADA: { mensaje: 'Incidencia no encontrada', status: 404 },
  YA_TIENE_TAREA_ACTIVA:    { mensaje: 'La incidencia ya tiene una tarea activa', status: 400 },
}

// POST /api/admin/tareas — crear tarea urgente o reasignar tecnico a incidencia
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (session.user.role !== 'admin') return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })

  const adminId = parseInt(session.user.id)
  const body = await request.json()
  const { incidenciaId, categoriaId, latitud, longitud, descripcion, tecnicoId } = body

  // tecnicoId es obligatorio en ambos modos
  if (!tecnicoId) {
    return NextResponse.json({ error: 'tecnicoId es obligatorio' }, { status: 400 })
  }

  try {
    // Modo 1: incidenciaId presente — asignar tecnico a incidencia existente
    // Ocurre cuando la IA aprobó pero no habia tecnicos disponibles,
    // o cuando el admin cancela una tarea y reasigna manualmente
    if (incidenciaId) {
      const resultado = await TareaService.asignarAIncidenciaExistente(incidenciaId, tecnicoId, adminId)
      return NextResponse.json({ success: true, data: resultado }, { status: 201 })
    }

    // Modo 2: sin incidenciaId — crear nueva incidencia y tarea urgente (RF-21)
    if (!categoriaId || !latitud || !longitud || !descripcion) {
      return NextResponse.json(
        { error: 'categoriaId, latitud, longitud y descripcion son obligatorios' },
        { status: 400 }
      )
    }

    const resultado = await TareaService.crearUrgente(
      categoriaId, latitud, longitud, descripcion, tecnicoId, adminId
    )
    return NextResponse.json({ success: true, data: resultado }, { status: 201 })

  } catch (error: any) {
    const err = ERRORES[error.message]
    if (err) return NextResponse.json({ error: err.mensaje }, { status: err.status })
    console.error('Error en POST /api/admin/tareas:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}