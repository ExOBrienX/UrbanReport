/**
 * app/api/admin/reportes/route.ts — Bandeja de revision manual del admin.
 * Solo accesible para usuarios con rol 'admin'.
 * Delega la logica de negocio a ReporteService (patron Repository).
 *
 * GET /api/admin/reportes — lista de reportes en estado 'pendiente_revision'.
 *   Son reportes que la IA no pudo aprobar automaticamente por baja confianza
 *   o categoria no identificada, y requieren decision manual del admin.
 *
 * Usado por: app/admin/components/BandejaRevision.tsx
 * Depende de: ReporteService, NextAuth
 */

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../../lib/auth'
import { ReporteService } from '../../../lib/services/ReporteService'

// GET /api/admin/reportes — reportes pendientes de revision manual
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (session.user.role !== 'admin') return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })

  try {
    // El servicio filtra por estado 'pendiente_revision' e incluye datos de la IA
    const reportes = await ReporteService.obtenerPendientesRevision()
    return NextResponse.json({ success: true, reportes }, { status: 200 })
  } catch (error) {
    console.error('Error obteniendo reportes en revision:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}