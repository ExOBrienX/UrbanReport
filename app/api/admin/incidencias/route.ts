/**
 * app/api/admin/incidencias/route.ts — Listado de incidencias activas para el panel admin.
 * Solo accesible para usuarios con rol 'admin'.
 *
 * GET /api/admin/incidencias — devuelve todas las incidencias no completadas,
 *   ordenadas por puntaje de prioridad descendente.
 *   Incluye la tarea activa mas reciente con su tecnico asignado,
 *   y todos los reportes ciudadanos ordenados del mas antiguo al mas reciente
 *   para que el admin pueda ver el historial completo de reportes duplicados.
 *
 *   Solo incluye incidencias con reportes ciudadanos reales (foto_url no vacia),
 *   excluyendo las urgentes creadas por el admin que tienen su propio endpoint.
 *
 * Usado por: app/admin/components/GestionIncidencias.tsx
 * Depende de: prisma, NextAuth
 */

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../../lib/auth'
import { prisma } from '../../../lib/prisma'

// GET /api/admin/incidencias — incidencias activas ordenadas por prioridad
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (session.user.role !== 'admin') return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })

  const incidencias = await prisma.incidencia.findMany({
    where: {
      estado: { not: 'completado' },
      reportes: { some: { foto_url: { not: '' } } }
    },
    include: {
      categoria: true,
      tareas: {
        where: { estado: { not: 'cancelada' } },
        include: { tecnico: { select: { id: true, nombre: true } } },
        orderBy: { creado_en: 'desc' },
        take: 1
      },
      // Todos los reportes ordenados del original al mas reciente
      reportes: {
        where: { foto_url: { not: '' } },
        orderBy: { creado_en: 'asc' },
        select: { id: true, descripcion: true, foto_url: true, creado_en: true }
      }
    },
    orderBy: { puntaje_prioridad: 'desc' }
  })

  return NextResponse.json({ success: true, incidencias }, { status: 200 })
}