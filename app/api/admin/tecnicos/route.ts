/**
 * app/api/admin/tecnicos/route.ts
 * GET — Lista de técnicos con especialidades y carga de trabajo.
 * POST — Crear nuevo técnico.
 * Solo accesible para usuarios con rol 'admin'.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../../lib/auth'
import { UsuarioService } from '../../../lib/services/UsuarioService'

const ERRORES: Record<string, { mensaje: string; status: number }> = {
  EMAIL_YA_EXISTE: { mensaje: 'El email ya está registrado', status: 400 },
  RUT_YA_EXISTE:   { mensaje: 'El RUT ya está registrado', status: 400 },
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (session.user.role !== 'admin') return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })

  try {
    const tecnicos = await UsuarioService.obtenerTecnicos()
    return NextResponse.json({ success: true, tecnicos }, { status: 200 })
  } catch (error) {
    console.error('Error obteniendo técnicos:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (session.user.role !== 'admin') return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })

  const body = await request.json()
  const { nombre, email, password, rut, telefono } = body

  if (!nombre || !email || !password || !rut) {
    return NextResponse.json({ error: 'nombre, email, password y rut son obligatorios' }, { status: 400 })
  }

  try {
    const tecnico = await UsuarioService.crear(nombre, email, password, rut, telefono)
    return NextResponse.json({ success: true, tecnico }, { status: 201 })
  } catch (error: any) {
    const err = ERRORES[error.message]
    if (err) return NextResponse.json({ error: err.mensaje }, { status: err.status })
    console.error('Error creando técnico:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}