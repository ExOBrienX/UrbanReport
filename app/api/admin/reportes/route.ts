/**
 * app/api/admin/reportes/route.ts — Bandeja de revision manual del admin.
 * Depende de: ReporteService, ResponseFactory, NextAuth
 */
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../../lib/auth'
import { ReporteService } from '../../../lib/services/ReporteService'
import { ResponseFactory } from '../../../lib/factories/ResponseFactory'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) { const r = ResponseFactory.unauthorized(); return NextResponse.json(r.body, { status: r.status }) }
  if (session.user.role !== 'admin') { const r = ResponseFactory.forbidden(); return NextResponse.json(r.body, { status: r.status }) }

  try {
    const reportes = await ReporteService.obtenerPendientesRevision()
    const r = ResponseFactory.success({ reportes })
    return NextResponse.json(r.body, { status: r.status })
  } catch (error) {
    console.error('Error obteniendo reportes en revision:', error)
    const r = ResponseFactory.error()
    return NextResponse.json(r.body, { status: r.status })
  }
}