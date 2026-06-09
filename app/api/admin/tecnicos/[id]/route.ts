/**
 * app/api/admin/tecnicos/[id]/route.ts — Edicion y cambio de estado de un tecnico.
 * Solo accesible para usuarios con rol 'admin'.
 * Delega la logica de negocio a UsuarioService (patron Repository).
 *
 * PATCH /api/admin/tecnicos/[id] — opera segun la accion enviada en el body:
 *   { accion: 'editar',     nombre?, email?, telefono?, password? }
 *   { accion: 'desactivar' } — bloquea acceso y recepcion de tareas
 *   { accion: 'activar'   } — restaura acceso del tecnico
 *
 * Usado por: app/admin/components/GestionTecnicos.tsx
 * Depende de: UsuarioService, NextAuth
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../../../lib/auth'
import { UsuarioService } from '../../../../lib/services/UsuarioService'

// Traduccion de errores del servicio a mensajes legibles para el cliente
const ERRORES: Record<string, { mensaje: string; status: number }> = {
  TECNICO_NO_ENCONTRADO:        { mensaje: 'Tecnico no encontrado', status: 404 },
  EMAIL_YA_EXISTE:              { mensaje: 'El email ya esta registrado', status: 400 },
  TECNICO_YA_INACTIVO:          { mensaje: 'El tecnico ya esta inactivo', status: 400 },
  TECNICO_YA_ACTIVO:            { mensaje: 'El tecnico ya esta activo', status: 400 },
  TECNICO_TIENE_TAREAS_ACTIVAS: { mensaje: 'El tecnico tiene tareas activas, cancelalas primero', status: 400 },
}

// PATCH /api/admin/tecnicos/[id] — editar, activar o desactivar un tecnico
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

  // Validar accion antes de llamar al servicio
  if (!accion || !['editar', 'desactivar', 'activar'].includes(accion)) {
    return NextResponse.json({ error: 'Accion invalida' }, { status: 400 })
  }

  try {
    let resultado

    if (accion === 'editar') {
      // datos contiene los campos a actualizar — el servicio hashea la password si viene
      resultado = await UsuarioService.editar(tecnicoId, datos)
    } else if (accion === 'desactivar') {
      // El servicio verifica que no tenga tareas activas antes de desactivar
      resultado = await UsuarioService.desactivar(tecnicoId)
    } else {
      resultado = await UsuarioService.activar(tecnicoId)
    }

    return NextResponse.json({ success: true, tecnico: resultado }, { status: 200 })
  } catch (error: any) {
    const err = ERRORES[error.message]
    if (err) return NextResponse.json({ error: err.mensaje }, { status: err.status })
    console.error('Error actualizando tecnico:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}