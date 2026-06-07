/**
 * app/api/admin/reportes/route.ts
 * GET — Bandeja de revisión manual del admin.
 * Solo accesible para usuarios con rol 'admin'.
 */

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../../lib/auth'
import { ReporteService } from '../../../lib/services/ReporteService'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (session.user.role !== 'admin') return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })

  try {
    const reportes = await ReporteService.obtenerPendientesRevision()
    return NextResponse.json({ success: true, reportes }, { status: 200 })
  } catch (error) {
    console.error('Error obteniendo reportes en revisión:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}