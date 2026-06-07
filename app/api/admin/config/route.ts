/**
 * app/api/admin/config/route.ts
 * GET — Obtener todas las configuraciones del sistema.
 * PUT — Actualizar el valor de una configuración.
 * Solo accesible para usuarios con rol 'admin'.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../../lib/auth'
import { ConfiguracionService } from '../../../lib/services/Configuracionservice'

const ERRORES: Record<string, { mensaje: string; status: number }> = {
  CONFIG_NO_ENCONTRADA: { mensaje: 'Configuración no encontrada', status: 404 },
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (session.user.role !== 'admin') return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })

  try {
    const configuraciones = await ConfiguracionService.obtenerTodas()
    return NextResponse.json({ success: true, configuraciones }, { status: 200 })
  } catch (error) {
    console.error('Error obteniendo configuraciones:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (session.user.role !== 'admin') return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })

  const adminId = parseInt(session.user.id)
  const body = await request.json()
  const { clave, valor } = body

  if (!clave || valor === undefined) {
    return NextResponse.json({ error: 'clave y valor son obligatorios' }, { status: 400 })
  }

  try {
    const config = await ConfiguracionService.actualizar(clave, String(valor), adminId)
    return NextResponse.json({ success: true, config }, { status: 200 })
  } catch (error: any) {
    const err = ERRORES[error.message]
    if (err) return NextResponse.json({ error: err.mensaje }, { status: err.status })
    console.error('Error actualizando configuración:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}