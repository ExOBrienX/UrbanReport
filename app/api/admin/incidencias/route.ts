// app/api/admin/incidencias/route.ts
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../../lib/auth'
import { prisma } from '../../../lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (session.user.role !== 'admin') return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })

  const incidencias = await prisma.incidencia.findMany({
    where: { estado: { not: 'completado' } },
    include: {
      categoria: true,
      tareas: {
        where: { estado: { not: 'cancelada' } },
        include: { tecnico: { select: { id: true, nombre: true } } },
        orderBy: { creado_en: 'desc' },
        take: 1
      },
      reportes: {
        take: 1,
        orderBy: { creado_en: 'desc' },
        select: { descripcion: true, foto_url: true }
      }
    },
    orderBy: { puntaje_prioridad: 'desc' }
  })

  return NextResponse.json({ success: true, incidencias }, { status: 200 })
}