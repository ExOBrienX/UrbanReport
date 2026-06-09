/**
 * app/api/admin/tecnicos/[id]/tareas/route.ts
 * GET — Historial completo de tareas de un técnico para el panel admin.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../../../../lib/auth'
import { prisma } from '../../../../../lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (session.user.role !== 'admin') return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })

  const { id } = await params
  const tecnicoId = parseInt(id)

  const tareas = await prisma.tarea.findMany({
    where: { tecnico_id: tecnicoId },
    include: {
      incidencia: {
        include: {
          categoria: { select: { nombre: true } },
          // Incluir reportes con foto y resumen IA
          reportes: {
            take: 1,
            orderBy: { creado_en: 'desc' },
            select: {
              foto_url: true,
              descripcion: true,
              resumen_ia: true,
              confianza_ia: true,
            }
          }
        }
      }
    },
    orderBy: { creado_en: 'desc' }
  })

  return NextResponse.json({ success: true, tareas })
}