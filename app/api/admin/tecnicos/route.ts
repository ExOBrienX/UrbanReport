/**
 * app/api/admin/tecnicos/route.ts — Listado y creacion de tecnicos.
 * Solo accesible para usuarios con rol 'admin'.
 * Delega la logica de negocio a UsuarioService (patron Repository).
 *
 * GET  /api/admin/tecnicos — lista todos los tecnicos con especialidades
 *                            y cantidad de tareas activas (carga de trabajo).
 * POST /api/admin/tecnicos — crea un nuevo tecnico con credenciales iniciales.
 *                            El admin asigna las especialidades en un paso separado.
 *
 * Usado por: app/admin/components/GestionTecnicos.tsx
 * Depende de: UsuarioService, NextAuth
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../../lib/auth'
import { UsuarioService } from '../../../lib/services/UsuarioService'

// Traduccion de errores del servicio a mensajes legibles para el cliente
const ERRORES: Record<string, { mensaje: string; status: number }> = {
  EMAIL_YA_EXISTE: { mensaje: 'El email ya esta registrado', status: 400 },
  RUT_YA_EXISTE:   { mensaje: 'El RUT ya esta registrado',   status: 400 },
}

// GET /api/admin/tecnicos — lista de tecnicos con especialidades y carga actual
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (session.user.role !== 'admin') return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })

  try {
    const tecnicos = await UsuarioService.obtenerTecnicos()
    return NextResponse.json({ success: true, tecnicos }, { status: 200 })
  } catch (error) {
    console.error('Error obteniendo tecnicos:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

// POST /api/admin/tecnicos — crear nuevo tecnico con credenciales iniciales
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (session.user.role !== 'admin') return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })

  const body = await request.json()
  const { nombre, email, password, rut, telefono } = body

  // Validar campos obligatorios antes de llamar al servicio
  if (!nombre || !email || !password || !rut) {
    return NextResponse.json(
      { error: 'nombre, email, password y rut son obligatorios' },
      { status: 400 }
    )
  }

  try {
    // El servicio hashea la password y verifica duplicados de email y RUT
    const tecnico = await UsuarioService.crear(nombre, email, password, rut, telefono)
    return NextResponse.json({ success: true, tecnico }, { status: 201 })
  } catch (error: any) {
    const err = ERRORES[error.message]
    if (err) return NextResponse.json({ error: err.mensaje }, { status: err.status })
    console.error('Error creando tecnico:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}