/**
 * app/api/admin/incidencias/route.ts — Listado de incidencias activas para el panel admin.
 * Solo accesible para usuarios con rol 'admin'.
 *
 * GET /api/admin/incidencias — devuelve todas las incidencias no completadas,
 *   ordenadas por puntaje de prioridad descendente.
 *   Incluye la tarea activa mas reciente con su tecnico asignado,
 *   y el reporte ciudadano mas reciente con foto y descripcion.
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
      // Solo incidencias con reporte ciudadano real — excluye urgentes del admin
      reportes: { some: { foto_url: { not: '' } } }
    },
    include: {
      categoria: true,
      tareas: {
        // Solo la tarea activa mas reciente — excluye canceladas
        where: { estado: { not: 'cancelada' } },
        include: { tecnico: { select: { id: true, nombre: true } } },
        orderBy: { creado_en: 'desc' },
        take: 1
      },
      reportes: {
        // Solo el reporte mas reciente con foto ciudadana
        where: { foto_url: { not: '' } },
        take: 1,
        orderBy: { creado_en: 'desc' },
        select: { descripcion: true, foto_url: true }
      }
    },
    orderBy: { puntaje_prioridad: 'desc' } // mayor prioridad primero
  })

  return NextResponse.json({ success: true, incidencias }, { status: 200 })
}