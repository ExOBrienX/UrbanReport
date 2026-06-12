/**
 * app/api/admin/tecnicos/especialidad/route.ts
 * Depende de: UsuarioService, ResponseFactory, NextAuth
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../../../lib/auth'
import { UsuarioService } from '../../../../lib/services/UsuarioService'
import { ResponseFactory } from '../../../../lib/factories/ResponseFactory'

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) { const r = ResponseFactory.unauthorized(); return NextResponse.json(r.body, { status: r.status }) }
  if (session.user.role !== 'admin') { const r = ResponseFactory.forbidden(); return NextResponse.json(r.body, { status: r.status }) }

  const { searchParams } = new URL(request.url)
  const categoriaId = searchParams.get('categoriaId')

  if (!categoriaId) {
    const r = ResponseFactory.validacion('categoriaId es obligatorio')
    return NextResponse.json(r.body, { status: r.status })
  }

  try {
    const tecnicos = await UsuarioService.obtenerTecnicosPorEspecialidad(parseInt(categoriaId))
    const r = ResponseFactory.success({ tecnicos })
    return NextResponse.json(r.body, { status: r.status })
  } catch (error) {
    console.error('Error obteniendo tecnicos por especialidad:', error)
    const r = ResponseFactory.error()
    return NextResponse.json(r.body, { status: r.status })
  }
}