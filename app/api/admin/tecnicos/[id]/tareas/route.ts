/**
 * app/api/admin/tecnicos/[id]/tareas/route.ts
 * GET — Historial completo de tareas de un tecnico para el panel admin.
 *
 * Devuelve todas las tareas del tecnico ordenadas de mas reciente a mas antigua,
 * incluyendo la incidencia asociada con su categoria y el reporte ciudadano
 * (foto, descripcion y resumen IA) para mostrar en el modal de historial.
 *
 * Se incluyen tareas en todos los estados — activas, completadas y canceladas —
 * para que el admin tenga visibilidad total del desempeno del tecnico.
 *
 * Usado por: app/admin/components/ModalHistorialTareas.tsx
 * Depende de: prisma, NextAuth
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../../../../lib/auth'
import { prisma } from '../../../../../lib/prisma'

// GET /api/admin/tecnicos/[id]/tareas — historial completo de tareas del tecnico
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
    where: { tecnico_id: tecnicoId }, // todas las tareas del tecnico sin filtro de estado
    include: {
      incidencia: {
        include: {
          categoria: { select: { nombre: true } },
          // Solo el reporte mas reciente — contiene foto y resumen IA para el detalle
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
    orderBy: { creado_en: 'desc' } // mas recientes primero
  })

  return NextResponse.json({ success: true, tareas })
}