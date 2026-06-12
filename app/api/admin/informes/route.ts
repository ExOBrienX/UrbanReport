/**
 * app/api/admin/informes/route.ts — Generacion de informe mensual con IA (RF-24).
 * Depende de: AIService, ResponseFactory, NextAuth
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../../lib/auth'
import { AIService } from '../../../lib/services/AIService'
import { ResponseFactory } from '../../../lib/factories/ResponseFactory'

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) { const r = ResponseFactory.unauthorized(); return NextResponse.json(r.body, { status: r.status }) }
  if (session.user.role !== 'admin') { const r = ResponseFactory.forbidden(); return NextResponse.json(r.body, { status: r.status }) }

  const body = await request.json()
  const { mes, anio } = body

  if (!mes || !anio || mes < 1 || mes > 12) {
    const r = ResponseFactory.validacion('mes (1-12) y anio son obligatorios')
    return NextResponse.json(r.body, { status: r.status })
  }

  try {
    const informe = await AIService.generarInformeMensual(mes, anio)
    const r = ResponseFactory.success({ informe })
    return NextResponse.json(r.body, { status: r.status })
  } catch (error) {
    console.error('Error generando informe:', error)
    const r = ResponseFactory.error('Error al generar el informe')
    return NextResponse.json(r.body, { status: r.status })
  }
}