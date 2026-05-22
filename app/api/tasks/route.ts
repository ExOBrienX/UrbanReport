import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../lib/auth'
import { prisma } from '../../lib/prisma'

// GET /api/tasks — cola de tareas para el técnico autenticado
export async function GET() {
  const session = await getServerSession(authOptions)

  if (!session) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
  if (session.user.role !== 'tecnico') {
    return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })
  }

  const tecnicoId = parseInt(session.user.id)

  try {
    const especialidades = await prisma.especialidad.findMany({
      where: { usuario_id: tecnicoId },
      select: { categoria_id: true }
    })
    const categoriaIds = especialidades.map(e => e.categoria_id)

    if (categoriaIds.length === 0) {
      return NextResponse.json({ success: true, tareas: [] }, { status: 200 })
    }

    // Traer todas las tareas candidatas y filtrar en memoria
    // para evitar el problema de tipo con tecnico_id: null en Prisma
    const todasTareas = await prisma.tarea.findMany({
      where: {
        OR: [
          // Tareas asignadas de la especialidad del técnico (sin importar tecnico_id aún)
          {
            estado: 'asignada',
            incidencia: {
              categoria_id: { in: categoriaIds },
              estado: { not: 'completado' }
            }
          },
          // Sus propias tareas activas
          {
            tecnico_id: tecnicoId,
            estado: { in: ['aceptada', 'en_curso', 'atrasada'] }
          }
        ]
      },
      include: {
        incidencia: {
          include: {
            categoria: true,
            reportes: {
              take: 1,
              orderBy: { creado_en: 'desc' },
              select: {
                foto_url: true,
                descripcion: true,
                resumen_ia: true,
                creado_en: true
              }
            }
          }
        }
      },
      orderBy: {
        incidencia: {
          puntaje_prioridad: 'desc'
        }
      }
    })

    // Filtrar en memoria: solo tareas sin técnico asignado + las propias activas
    const tareas = todasTareas.filter(t =>
      t.tecnico_id === null || t.tecnico_id === tecnicoId
    )

    return NextResponse.json({ success: true, tareas }, { status: 200 })
  } catch (error) {
    console.error('Error obteniendo tareas:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}