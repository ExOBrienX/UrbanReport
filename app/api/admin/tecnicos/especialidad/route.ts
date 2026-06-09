/**
 * app/api/admin/tecnicos/especialidad/route.ts
 * GET — Tecnicos con especialidad en una categoria especifica.
 *
 * Devuelve la lista de tecnicos activos que tienen asignada la categoria
 * indicada, incluyendo su carga de trabajo actual (tareas activas).
 * Usado en los modales de asignacion para que el admin elija al tecnico
 * mas adecuado segun disponibilidad.
 *
 * Usado por: BandejaRevision (paso 2), GestionIncidencias (modal asignar)
 * Depende de: UsuarioService, NextAuth
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../../../lib/auth'
import { UsuarioService } from '../../../../lib/services/UsuarioService'

// GET /api/admin/tecnicos/especialidad?categoriaId=... — tecnicos por especialidad
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (session.user.role !== 'admin') return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const categoriaId = searchParams.get('categoriaId')

  if (!categoriaId) {
    return NextResponse.json({ error: 'categoriaId es obligatorio' }, { status: 400 })
  }

  try {
    // El servicio filtra por especialidad y excluye tecnicos inactivos
    const tecnicos = await UsuarioService.obtenerTecnicosPorEspecialidad(parseInt(categoriaId))
    return NextResponse.json({ success: true, tecnicos }, { status: 200 })
  } catch (error) {
    console.error('Error obteniendo tecnicos por especialidad:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}