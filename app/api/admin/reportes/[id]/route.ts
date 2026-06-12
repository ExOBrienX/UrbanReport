/**
 * app/api/admin/reportes/[id]/route.ts — Aprobacion o rechazo de reportes.
 * Depende de: ReporteService, ResponseFactory, NextAuth
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../../../lib/auth'
import { ReporteService } from '../../../../lib/services/ReporteService'
import { ResponseFactory } from '../../../../lib/factories/ResponseFactory'

const ERRORES: Record<string, { mensaje: string; status: number }> = {
  REPORTE_NO_ENCONTRADO:  { mensaje: 'Reporte no encontrado', status: 404 },
  REPORTE_NO_EN_REVISION: { mensaje: 'El reporte no esta en estado de revision', status: 400 },
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) { const r = ResponseFactory.unauthorized(); return NextResponse.json(r.body, { status: r.status }) }
  if (session.user.role !== 'admin') { const r = ResponseFactory.forbidden(); return NextResponse.json(r.body, { status: r.status }) }

  const adminId = parseInt(session.user.id)
  const { id } = await params
  const reporteId = parseInt(id)
  const body = await request.json()
  const { accion, categoriaId, tecnicoId } = body

  if (!accion || !['aprobar', 'rechazar'].includes(accion)) {
    const r = ResponseFactory.validacion('Accion invalida')
    return NextResponse.json(r.body, { status: r.status })
  }

  if (accion === 'aprobar' && (!categoriaId || !tecnicoId)) {
    const r = ResponseFactory.validacion('categoriaId y tecnicoId son obligatorios para aprobar')
    return NextResponse.json(r.body, { status: r.status })
  }

  try {
    if (accion === 'aprobar') {
      const resultado = await ReporteService.aprobar(reporteId, categoriaId, tecnicoId, adminId)
      const r = ResponseFactory.success({ data: resultado })
      return NextResponse.json(r.body, { status: r.status })
    } else {
      const reporte = await ReporteService.rechazar(reporteId, adminId)
      const r = ResponseFactory.success({ reporte })
      return NextResponse.json(r.body, { status: r.status })
    }
  } catch (error: any) {
    const r = ResponseFactory.serviceError(ERRORES, error.message)
    console.error('Error procesando reporte:', error)
    return NextResponse.json(r.body, { status: r.status })
  }
}