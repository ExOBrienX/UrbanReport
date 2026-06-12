/**
 * app/api/admin/config/route.ts — Gestion de configuracion del sistema.
 * Depende de: ConfiguracionService, ResponseFactory, NextAuth
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../../lib/auth'
import { ConfiguracionService } from '../../../lib/services/Configuracionservice'
import { ResponseFactory } from '../../../lib/factories/ResponseFactory'

const ERRORES: Record<string, { mensaje: string; status: number }> = {
  CONFIG_NO_ENCONTRADA: { mensaje: 'Configuracion no encontrada', status: 404 },
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) { const r = ResponseFactory.unauthorized(); return NextResponse.json(r.body, { status: r.status }) }
  if (session.user.role !== 'admin') { const r = ResponseFactory.forbidden(); return NextResponse.json(r.body, { status: r.status }) }

  try {
    const configuraciones = await ConfiguracionService.obtenerTodas()
    const r = ResponseFactory.success({ configuraciones })
    return NextResponse.json(r.body, { status: r.status })
  } catch (error) {
    console.error('Error obteniendo configuraciones:', error)
    const r = ResponseFactory.error()
    return NextResponse.json(r.body, { status: r.status })
  }
}

export async function PUT(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) { const r = ResponseFactory.unauthorized(); return NextResponse.json(r.body, { status: r.status }) }
  if (session.user.role !== 'admin') { const r = ResponseFactory.forbidden(); return NextResponse.json(r.body, { status: r.status }) }

  const adminId = parseInt(session.user.id)
  const body = await request.json()
  const { clave, valor } = body

  if (!clave || valor === undefined) {
    const r = ResponseFactory.validacion('clave y valor son obligatorios')
    return NextResponse.json(r.body, { status: r.status })
  }

  try {
    const config = await ConfiguracionService.actualizar(clave, String(valor), adminId)
    const r = ResponseFactory.success({ config })
    return NextResponse.json(r.body, { status: r.status })
  } catch (error: any) {
    const r = ResponseFactory.serviceError(ERRORES, error.message)
    console.error('Error actualizando configuracion:', error)
    return NextResponse.json(r.body, { status: r.status })
  }
}