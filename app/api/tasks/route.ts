/**
 * app/api/tasks/route.ts — Cola de tareas del técnico autenticado.
 * Solo accesible para usuarios con rol 'tecnico'.
 * Delega la lógica de negocio a TareaService (patrón Repository).
 *
 * Usado por: app/tecnico/page.tsx al cargar el panel del técnico.
 * Depende de: TareaService, NextAuth
 */

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../lib/auth'
import { TareaService } from '../../lib/services/TareaService'

// GET /api/tasks — devuelve la cola de tareas del técnico autenticado
export async function GET() {
  const session = await getServerSession(authOptions)

  if (!session) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
  if (session.user.role !== 'tecnico') {
    return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })
  }

  const tecnicoId = parseInt(session.user.id)

  try {
    // Delegar al TareaService — obtiene tareas disponibles de la especialidad
    // del técnico más sus tareas activas propias, ordenadas por prioridad
    const tareas = await TareaService.obtenerPorTecnico(tecnicoId)
    return NextResponse.json({ success: true, tareas }, { status: 200 })
  } catch (error) {
    console.error('Error obteniendo tareas:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}