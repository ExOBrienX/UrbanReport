/**
 * app/api/admin/tecnicos/[id]/route.ts — Edicion y cambio de estado de un tecnico.
 * Depende de: UsuarioService, ResponseFactory, NextAuth
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../../../lib/auth'
import { UsuarioService } from '../../../../lib/services/UsuarioService'
import { ResponseFactory } from '../../../../lib/factories/ResponseFactory'

const ERRORES: Record<string, { mensaje: string; status: number }> = {
  TECNICO_NO_ENCONTRADO:        { mensaje: 'Tecnico no encontrado', status: 404 },
  EMAIL_YA_EXISTE:              { mensaje: 'El email ya esta registrado', status: 400 },
  TECNICO_YA_INACTIVO:          { mensaje: 'El tecnico ya esta inactivo', status: 400 },
  TECNICO_YA_ACTIVO:            { mensaje: 'El tecnico ya esta activo', status: 400 },
  TECNICO_TIENE_TAREAS_ACTIVAS: { mensaje: 'El tecnico tiene tareas activas, cancelalas primero', status: 400 },
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) { const r = ResponseFactory.unauthorized(); return NextResponse.json(r.body, { status: r.status }) }
  if (session.user.role !== 'admin') { const r = ResponseFactory.forbidden(); return NextResponse.json(r.body, { status: r.status }) }

  const { id } = await params
  const tecnicoId = parseInt(id)
  const { accion, ...datos } = await request.json()

  if (!accion || !['editar', 'desactivar', 'activar'].includes(accion)) {
    const r = ResponseFactory.validacion('Accion invalida')
    return NextResponse.json(r.body, { status: r.status })
  }

  try {
    let resultado
    if (accion === 'editar') resultado = await UsuarioService.editar(tecnicoId, datos)
    else if (accion === 'desactivar') resultado = await UsuarioService.desactivar(tecnicoId)
    else resultado = await UsuarioService.activar(tecnicoId)

    const r = ResponseFactory.success({ tecnico: resultado })
    return NextResponse.json(r.body, { status: r.status })
  } catch (error: any) {
    const r = ResponseFactory.serviceError(ERRORES, error.message)
    console.error('Error actualizando tecnico:', error)
    return NextResponse.json(r.body, { status: r.status })
  }
}