/**
 * app/api/admin/tecnicos/route.ts — Listado y creacion de tecnicos.
 * Depende de: UsuarioService, ResponseFactory, NextAuth
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../../lib/auth'
import { UsuarioService } from '../../../lib/services/UsuarioService'
import { ResponseFactory } from '../../../lib/factories/ResponseFactory'

const ERRORES: Record<string, { mensaje: string; status: number }> = {
  EMAIL_YA_EXISTE: { mensaje: 'El email ya esta registrado', status: 400 },
  RUT_YA_EXISTE:   { mensaje: 'El RUT ya esta registrado',   status: 400 },
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) { const r = ResponseFactory.unauthorized(); return NextResponse.json(r.body, { status: r.status }) }
  if (session.user.role !== 'admin') { const r = ResponseFactory.forbidden(); return NextResponse.json(r.body, { status: r.status }) }

  try {
    const tecnicos = await UsuarioService.obtenerTecnicos()
    const r = ResponseFactory.success({ tecnicos })
    return NextResponse.json(r.body, { status: r.status })
  } catch (error) {
    console.error('Error obteniendo tecnicos:', error)
    const r = ResponseFactory.error()
    return NextResponse.json(r.body, { status: r.status })
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) { const r = ResponseFactory.unauthorized(); return NextResponse.json(r.body, { status: r.status }) }
  if (session.user.role !== 'admin') { const r = ResponseFactory.forbidden(); return NextResponse.json(r.body, { status: r.status }) }

  const body = await request.json()
  const { nombre, email, password, rut, telefono } = body

  if (!nombre || !email || !password || !rut) {
    const r = ResponseFactory.validacion('nombre, email, password y rut son obligatorios')
    return NextResponse.json(r.body, { status: r.status })
  }

  try {
    const tecnico = await UsuarioService.crear(nombre, email, password, rut, telefono)
    const r = ResponseFactory.success({ tecnico }, 201)
    return NextResponse.json(r.body, { status: r.status })
  } catch (error: any) {
    const r = ResponseFactory.serviceError(ERRORES, error.message)
    console.error('Error creando tecnico:', error)
    return NextResponse.json(r.body, { status: r.status })
  }
}