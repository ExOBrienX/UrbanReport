/**
 * app/api/admin/dashboard/route.ts — KPIs del dashboard admin.
 * Depende de: DashboardService, ResponseFactory, NextAuth
 */
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../../lib/auth'
import { DashboardService } from '../../../lib/services/DashboardService'
import { ResponseFactory } from '../../../lib/factories/ResponseFactory'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) { const r = ResponseFactory.unauthorized(); return NextResponse.json(r.body, { status: r.status }) }
  if (session.user.role !== 'admin') { const r = ResponseFactory.forbidden(); return NextResponse.json(r.body, { status: r.status }) }

  try {
    const kpis = await DashboardService.obtenerKPIs()
    const r = ResponseFactory.success({ kpis })
    return NextResponse.json(r.body, { status: r.status })
  } catch (error) {
    console.error('Error obteniendo KPIs:', error)
    const r = ResponseFactory.error()
    return NextResponse.json(r.body, { status: r.status })
  }
}