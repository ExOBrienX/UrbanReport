/**
 * app/api/tasks/route.ts — Cola de tareas del técnico autenticado.
 * Depende de: TareaService, ResponseFactory, NextAuth
 */
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../lib/auth'
import { TareaService } from '../../lib/services/TareaService'
import { ResponseFactory } from '../../lib/factories/ResponseFactory'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) { const r = ResponseFactory.unauthorized(); return NextResponse.json(r.body, { status: r.status }) }
  if (session.user.role !== 'tecnico') { const r = ResponseFactory.forbidden(); return NextResponse.json(r.body, { status: r.status }) }

  const tecnicoId = parseInt(session.user.id)
  try {
    const tareas = await TareaService.obtenerPorTecnico(tecnicoId)
    const r = ResponseFactory.success({ tareas })
    return NextResponse.json(r.body, { status: r.status })
  } catch (error) {
    console.error('Error obteniendo tareas:', error)
    const r = ResponseFactory.error()
    return NextResponse.json(r.body, { status: r.status })
  }
}