/**
 * app/api/admin/tecnicos/especialidad/route.ts
 * GET — Obtener técnicos disponibles por categoría.
 * Usado en el modal de aprobación para que el admin elija a quién asignar.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../../../lib/auth'
import { UsuarioService } from '../../../../lib/services/UsuarioService'

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (session.user.role !== 'admin') return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const categoriaId = searchParams.get('categoriaId')

  if (!categoriaId) {
    return NextResponse.json({ error: 'categoriaId es obligatorio' }, { status: 400 })
  }

  try {
    const tecnicos = await UsuarioService.obtenerTecnicosPorEspecialidad(parseInt(categoriaId))
    return NextResponse.json({ success: true, tecnicos }, { status: 200 })
  } catch (error) {
    console.error('Error obteniendo técnicos por especialidad:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}