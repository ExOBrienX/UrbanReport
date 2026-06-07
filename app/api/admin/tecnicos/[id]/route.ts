/**
 * app/api/admin/tecnicos/[id]/route.ts
 * PATCH — Editar datos, activar o desactivar un técnico.
 * Solo accesible para usuarios con rol 'admin'.
 *
 * Body para editar:      { accion: 'editar', nombre?, email?, telefono?, password? }
 * Body para desactivar:  { accion: 'desactivar' }
 * Body para activar:     { accion: 'activar' }
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../../../lib/auth'
import { UsuarioService } from '../../../../lib/services/UsuarioService'

const ERRORES: Record<string, { mensaje: string; status: number }> = {
  TECNICO_NO_ENCONTRADO:       { mensaje: 'Técnico no encontrado', status: 404 },
  EMAIL_YA_EXISTE:             { mensaje: 'El email ya está registrado', status: 400 },
  TECNICO_YA_INACTIVO:         { mensaje: 'El técnico ya está inactivo', status: 400 },
  TECNICO_YA_ACTIVO:           { mensaje: 'El técnico ya está activo', status: 400 },
  TECNICO_TIENE_TAREAS_ACTIVAS:{ mensaje: 'El técnico tiene tareas activas, cancélalas primero', status: 400 },
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (session.user.role !== 'admin') return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })

  const { id } = await params
  const tecnicoId = parseInt(id)
  const body = await request.json()
  const { accion, ...datos } = body

  if (!accion || !['editar', 'desactivar', 'activar'].includes(accion)) {
    return NextResponse.json({ error: 'Acción inválida' }, { status: 400 })
  }

  try {
    let resultado
    if (accion === 'editar') {
      resultado = await UsuarioService.editar(tecnicoId, datos)
    } else if (accion === 'desactivar') {
      resultado = await UsuarioService.desactivar(tecnicoId)
    } else {
      resultado = await UsuarioService.activar(tecnicoId)
    }
    return NextResponse.json({ success: true, tecnico: resultado }, { status: 200 })
  } catch (error: any) {
    const err = ERRORES[error.message]
    if (err) return NextResponse.json({ error: err.mensaje }, { status: err.status })
    console.error('Error actualizando técnico:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}