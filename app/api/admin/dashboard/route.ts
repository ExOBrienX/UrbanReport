/**
 * app/api/admin/dashboard/route.ts — KPIs y estadisticas del dashboard admin.
 * Solo accesible para usuarios con rol 'admin'.
 * Delega el calculo de metricas a DashboardService.
 *
 * GET /api/admin/dashboard — devuelve todas las metricas del dashboard en una
 *   sola llamada para minimizar requests al cargar la vista principal del admin.
 *
 *   Incluye:
 *     - Resumen de incidencias por estado (pendiente, asignado, en_curso, completado)
 *     - Tasa de resolucion del mes actual
 *     - Tiempo promedio de resolucion por categoria
 *     - Ranking de tecnicos por tareas completadas en el mes
 *     - Cantidad de reportes pendientes de revision manual
 *     - Distribucion de incidencias activas por categoria
 *
 *   Tambien usado por AdminPage para actualizar el badge de pendientes en el sidebar.
 *
 * Usado por: app/admin/components/AdminDashboard.tsx, app/admin/page.tsx
 * Depende de: DashboardService, NextAuth
 */

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../../lib/auth'
import { DashboardService } from '../../../lib/services/DashboardService'

// GET /api/admin/dashboard — KPIs completos para el dashboard del admin
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (session.user.role !== 'admin') return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })

  try {
    // El servicio calcula todas las metricas en paralelo con Promise.all
    const kpis = await DashboardService.obtenerKPIs()
    return NextResponse.json({ success: true, kpis }, { status: 200 })
  } catch (error) {
    console.error('Error obteniendo KPIs:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}