/**
 * app/api/admin/dashboard/route.ts
 * GET — KPIs y estadísticas generales para el dashboard del admin.
 * Solo accesible para usuarios con rol 'admin'.
 *
 * Devuelve:
 *   - Resumen de incidencias por estado
 *   - Tasa de resolución del mes actual
 *   - Tiempo promedio de resolución por categoría
 *   - Técnico con más tareas completadas
 *   - Reportes pendientes de revisión
 *   - Incidencias por categoría
 */

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../../lib/auth'
import { DashboardService } from '../../../lib/services/DashboardService'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (session.user.role !== 'admin') return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })

  try {
    const kpis = await DashboardService.obtenerKPIs()
    return NextResponse.json({ success: true, kpis }, { status: 200 })
  } catch (error) {
    console.error('Error obteniendo KPIs:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}