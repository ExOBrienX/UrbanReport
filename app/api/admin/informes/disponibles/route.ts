/**
 * app/api/admin/informes/disponibles/route.ts
 * GET — Retorna los períodos (mes/año) que tienen incidencias registradas.
 * Usado por el selector del informe mensual para mostrar solo fechas válidas.
 */
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../../../lib/auth'
import { prisma } from '../../../../lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (session.user.role !== 'admin') return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })

  // Obtener todas las fechas de creación de incidencias
  const incidencias = await prisma.incidencia.findMany({
    select: { creado_en: true },
    orderBy: { creado_en: 'asc' }
  })

  // Construir set de periodos únicos {anio, mes} sin duplicados
  const periodosMap = new Map<string, Periodo>()
  incidencias.forEach(inc => {
    const d = new Date(inc.creado_en)
    const key = `${d.getFullYear()}-${d.getMonth() + 1}`
    if (!periodosMap.has(key)) {
      periodosMap.set(key, { anio: d.getFullYear(), mes: d.getMonth() + 1 })
    }
  })

  const periodos = Array.from(periodosMap.values())
    .sort((a, b) => a.anio !== b.anio ? a.anio - b.anio : a.mes - b.mes)

  return NextResponse.json({ success: true, periodos })
}

interface Periodo { anio: number; mes: number }