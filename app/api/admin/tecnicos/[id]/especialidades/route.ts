/**
 * app/api/admin/tecnicos/[id]/especialidades/route.ts
 * Depende de: UsuarioService, ResponseFactory, NextAuth
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../../../../lib/auth'
import { UsuarioService } from '../../../../../lib/services/UsuarioService'
import { ResponseFactory } from '../../../../../lib/factories/ResponseFactory'

const ERRORES: Record<string, { mensaje: string; status: number }> = {
  TECNICO_NO_ENCONTRADO:      { mensaje: 'Tecnico no encontrado', status: 404 },
  CATEGORIA_NO_ENCONTRADA:    { mensaje: 'Categoria no encontrada', status: 404 },
  ESPECIALIDAD_YA_ASIGNADA:   { mensaje: 'El tecnico ya tiene esa especialidad', status: 400 },
  ESPECIALIDAD_NO_ENCONTRADA: { mensaje: 'El tecnico no tiene esa especialidad', status: 404 },
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) { const r = ResponseFactory.unauthorized(); return NextResponse.json(r.body, { status: r.status }) }
  if (session.user.role !== 'admin') { const r = ResponseFactory.forbidden(); return NextResponse.json(r.body, { status: r.status }) }

  const { id } = await params
  const tecnicoId = parseInt(id)
  const { categoriaId } = await request.json()

  if (!categoriaId) {
    const r = ResponseFactory.validacion('categoriaId es obligatorio')
    return NextResponse.json(r.body, { status: r.status })
  }

  try {
    const especialidad = await UsuarioService.asignarEspecialidad(tecnicoId, categoriaId)
    const r = ResponseFactory.success({ especialidad }, 201)
    return NextResponse.json(r.body, { status: r.status })
  } catch (error: any) {
    const r = ResponseFactory.serviceError(ERRORES, error.message)
    console.error('Error asignando especialidad:', error)
    return NextResponse.json(r.body, { status: r.status })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) { const r = ResponseFactory.unauthorized(); return NextResponse.json(r.body, { status: r.status }) }
  if (session.user.role !== 'admin') { const r = ResponseFactory.forbidden(); return NextResponse.json(r.body, { status: r.status }) }

  const { id } = await params
  const tecnicoId = parseInt(id)
  const { categoriaId } = await request.json()

  if (!categoriaId) {
    const r = ResponseFactory.validacion('categoriaId es obligatorio')
    return NextResponse.json(r.body, { status: r.status })
  }

  try {
    await UsuarioService.quitarEspecialidad(tecnicoId, categoriaId)
    const r = ResponseFactory.success({})
    return NextResponse.json(r.body, { status: r.status })
  } catch (error: any) {
    const r = ResponseFactory.serviceError(ERRORES, error.message)
    console.error('Error quitando especialidad:', error)
    return NextResponse.json(r.body, { status: r.status })
  }
}