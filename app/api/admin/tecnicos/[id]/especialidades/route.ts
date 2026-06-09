/**
 * app/api/admin/tecnicos/[id]/especialidades/route.ts
 * Gestion de especialidades de un tecnico especifico.
 * Solo accesible para usuarios con rol 'admin'.
 * Delega la logica de negocio a UsuarioService (patron Repository).
 *
 * POST   /api/admin/tecnicos/[id]/especialidades — asignar una categoria al tecnico.
 * DELETE /api/admin/tecnicos/[id]/especialidades — quitar una categoria del tecnico.
 *
 * Las especialidades determinan que categorias de incidencias puede ver
 * y aceptar cada tecnico en su cola de tareas.
 *
 * Usado por: app/admin/components/GestionTecnicos.tsx (modal especialidades batch)
 * Depende de: UsuarioService, NextAuth
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../../../../lib/auth'
import { UsuarioService } from '../../../../../lib/services/UsuarioService'

// Traduccion de errores del servicio a mensajes legibles para el cliente
const ERRORES: Record<string, { mensaje: string; status: number }> = {
  TECNICO_NO_ENCONTRADO:      { mensaje: 'Tecnico no encontrado', status: 404 },
  CATEGORIA_NO_ENCONTRADA:    { mensaje: 'Categoria no encontrada', status: 404 },
  ESPECIALIDAD_YA_ASIGNADA:   { mensaje: 'El tecnico ya tiene esa especialidad', status: 400 },
  ESPECIALIDAD_NO_ENCONTRADA: { mensaje: 'El tecnico no tiene esa especialidad', status: 404 },
}

// POST /api/admin/tecnicos/[id]/especialidades — asignar categoria al tecnico
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

// DELETE /api/admin/tecnicos/[id]/especialidades — quitar categoria del tecnico
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
    // El servicio verifica que la especialidad exista antes de eliminarla
    await UsuarioService.quitarEspecialidad(tecnicoId, categoriaId)
    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error: any) {
    const err = ERRORES[error.message]
    if (err) return NextResponse.json({ error: err.mensaje }, { status: err.status })
    console.error('Error quitando especialidad:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}