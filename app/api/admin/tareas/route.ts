/**
 * app/api/admin/tareas/route.ts — Creacion de tareas por el administrador.
 * Depende de: TareaService, ResponseFactory, NextAuth
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../../lib/auth'
import { TareaService } from '../../../lib/services/TareaService'
import { ResponseFactory } from '../../../lib/factories/ResponseFactory'

const ERRORES: Record<string, { mensaje: string; status: number }> = {
  CATEGORIA_NO_ENCONTRADA:  { mensaje: 'Categoria no encontrada', status: 404 },
  TECNICO_NO_ENCONTRADO:    { mensaje: 'Tecnico no encontrado', status: 404 },
  INCIDENCIA_NO_ENCONTRADA: { mensaje: 'Incidencia no encontrada', status: 404 },
  YA_TIENE_TAREA_ACTIVA:    { mensaje: 'La incidencia ya tiene una tarea activa', status: 400 },
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) { const r = ResponseFactory.unauthorized(); return NextResponse.json(r.body, { status: r.status }) }
  if (session.user.role !== 'admin') { const r = ResponseFactory.forbidden(); return NextResponse.json(r.body, { status: r.status }) }

  const adminId = parseInt(session.user.id)
  const body = await request.json()
  const { incidenciaId, categoriaId, latitud, longitud, descripcion, tecnicoId } = body

  if (!tecnicoId) {
    const r = ResponseFactory.validacion('tecnicoId es obligatorio')
    return NextResponse.json(r.body, { status: r.status })
  }

  try {
    if (incidenciaId) {
      const resultado = await TareaService.asignarAIncidenciaExistente(incidenciaId, tecnicoId, adminId)
      const r = ResponseFactory.success({ data: resultado }, 201)
      return NextResponse.json(r.body, { status: r.status })
    }

    if (!categoriaId || !latitud || !longitud || !descripcion) {
      const r = ResponseFactory.validacion('categoriaId, latitud, longitud y descripcion son obligatorios')
      return NextResponse.json(r.body, { status: r.status })
    }

    const resultado = await TareaService.crearUrgente(categoriaId, latitud, longitud, descripcion, tecnicoId, adminId)
    const r = ResponseFactory.success({ data: resultado }, 201)
    return NextResponse.json(r.body, { status: r.status })
  } catch (error: any) {
    const r = ResponseFactory.serviceError(ERRORES, error.message)
    console.error('Error en POST /api/admin/tareas:', error)
    return NextResponse.json(r.body, { status: r.status })
  }
}