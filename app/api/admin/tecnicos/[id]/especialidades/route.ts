/**
 * app/api/admin/tecnicos/[id]/especialidades/route.ts
 * POST — Asignar especialidad a un técnico.
 * DELETE — Quitar especialidad a un técnico.
 * Solo accesible para usuarios con rol 'admin'.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../../../../lib/auth'
import { UsuarioService } from '../../../../../lib/services/UsuarioService'

const ERRORES: Record<string, { mensaje: string; status: number }> = {
  TECNICO_NO_ENCONTRADO:    { mensaje: 'Técnico no encontrado', status: 404 },
  CATEGORIA_NO_ENCONTRADA:  { mensaje: 'Categoría no encontrada', status: 404 },
  ESPECIALIDAD_YA_ASIGNADA: { mensaje: 'El técnico ya tiene esa especialidad', status: 400 },
  ESPECIALIDAD_NO_ENCONTRADA: { mensaje: 'El técnico no tiene esa especialidad', status: 404 },
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (session.user.role !== 'admin') return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })

  const { id } = await params
  const tecnicoId = parseInt(id)
  const body = await request.json()
  const { categoriaId } = body

  if (!categoriaId) {
    return NextResponse.json({ error: 'categoriaId es obligatorio' }, { status: 400 })
  }

  try {
    const especialidad = await UsuarioService.asignarEspecialidad(tecnicoId, categoriaId)
    return NextResponse.json({ success: true, especialidad }, { status: 201 })
  } catch (error: any) {
    const err = ERRORES[error.message]
    if (err) return NextResponse.json({ error: err.mensaje }, { status: err.status })
    console.error('Error asignando especialidad:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (session.user.role !== 'admin') return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })

  const { id } = await params
  const tecnicoId = parseInt(id)
  const body = await request.json()
  const { categoriaId } = body

  if (!categoriaId) {
    return NextResponse.json({ error: 'categoriaId es obligatorio' }, { status: 400 })
  }

  try {
    await UsuarioService.quitarEspecialidad(tecnicoId, categoriaId)
    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error: any) {
    const err = ERRORES[error.message]
    if (err) return NextResponse.json({ error: err.mensaje }, { status: err.status })
    console.error('Error quitando especialidad:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}