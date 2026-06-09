/**
 * app/api/admin/config/route.ts — Gestion de configuracion del sistema.
 * Solo accesible para usuarios con rol 'admin'.
 * Delega la logica de negocio a ConfiguracionService (patron Repository).
 *
 * GET /api/admin/config — lista todas las configuraciones del sistema.
 *   Usado por la vista de Configuracion para mostrar los parametros actuales.
 *
 * PUT /api/admin/config — actualiza el valor de una configuracion existente.
 *   Body: { clave: string, valor: string | number }
 *   Los cambios se aplican inmediatamente sin reiniciar el servidor.
 *
 *   Configuraciones disponibles:
 *     umbral_confianza_ia: porcentaje minimo para aprobacion automatica de reportes.
 *
 * Usado por: app/admin/components/Configuracion.tsx
 * Depende de: ConfiguracionService, NextAuth
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../../lib/auth'
import { ConfiguracionService } from '../../../lib/services/Configuracionservice'

// Traduccion de errores del servicio a mensajes legibles para el cliente
const ERRORES: Record<string, { mensaje: string; status: number }> = {
  CONFIG_NO_ENCONTRADA: { mensaje: 'Configuracion no encontrada', status: 404 },
}

// GET /api/admin/config — todas las configuraciones del sistema
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

// PUT /api/admin/config — actualizar valor de una configuracion existente
export async function PUT(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (session.user.role !== 'admin') return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })

  const adminId = parseInt(session.user.id)
  const body = await request.json()
  const { clave, valor } = body

  // Validar campos obligatorios — valor puede ser 0 por eso se compara con undefined
  if (!clave || valor === undefined) {
    return NextResponse.json({ error: 'clave y valor son obligatorios' }, { status: 400 })
  }

  try {
    // El servicio verifica que la clave exista y registra el adminId en logs
    const config = await ConfiguracionService.actualizar(clave, String(valor), adminId)
    return NextResponse.json({ success: true, config }, { status: 200 })
  } catch (error: any) {
    const err = ERRORES[error.message]
    if (err) return NextResponse.json({ error: err.mensaje }, { status: err.status })
    console.error('Error actualizando configuracion:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}