/**
 * app/api/admin/reportes/[id]/route.ts
 * PATCH — Aprobar o rechazar un reporte en revisión.
 * Solo accesible para usuarios con rol 'admin'.
 *
 * Body para aprobar:  { accion: 'aprobar', categoriaId: number, tecnicoId: number }
 * Body para rechazar: { accion: 'rechazar' }
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../../../lib/auth'
import { ReporteService } from '../../../../lib/services/ReporteService'

const ERRORES: Record<string, { mensaje: string; status: number }> = {
  REPORTE_NO_ENCONTRADO:  { mensaje: 'Reporte no encontrado', status: 404 },
  REPORTE_NO_EN_REVISION: { mensaje: 'El reporte no está en estado de revisión', status: 400 },
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (session.user.role !== 'admin') return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })

  const adminId = parseInt(session.user.id)
  const { id } = await params
  const reporteId = parseInt(id)
  const body = await request.json()
  const { accion, categoriaId, tecnicoId } = body

  if (!accion || !['aprobar', 'rechazar'].includes(accion)) {
    return NextResponse.json({ error: 'Acción inválida' }, { status: 400 })
  }

  if (accion === 'aprobar' && (!categoriaId || !tecnicoId)) {
    return NextResponse.json({ error: 'categoriaId y tecnicoId son obligatorios para aprobar' }, { status: 400 })
  }

  try {
    if (accion === 'aprobar') {
      const resultado = await ReporteService.aprobar(reporteId, categoriaId, tecnicoId, adminId)
      return NextResponse.json({ success: true, data: resultado }, { status: 200 })
    } else {
      const reporte = await ReporteService.rechazar(reporteId, adminId)
      return NextResponse.json({ success: true, reporte }, { status: 200 })
    }
  } catch (error: any) {
    const err = ERRORES[error.message]
    if (err) return NextResponse.json({ error: err.mensaje }, { status: err.status })
    console.error('Error procesando reporte:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}