/**
 * app/api/admin/informes/disponibles/route.ts — Periodos con datos para generar informes.
 * Solo accesible para usuarios con rol 'admin'.
 *
 * GET /api/admin/informes/disponibles — retorna los meses y anos que tienen
 *   incidencias registradas en BD, ordenados cronologicamente.
 *
 *   Usado por InformeMensual.tsx para poblar los selectores de fecha mostrando
 *   solo periodos validos — evita que el admin genere informes de meses vacios
 *   que resultarian en llamadas innecesarias a la IA.
 *
 * Usado por: app/admin/components/InformeMensual.tsx
 * Depende de: prisma, NextAuth
 */

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../../../lib/auth'
import { prisma } from '../../../../lib/prisma'

interface Periodo { anio: number; mes: number }

// GET /api/admin/informes/disponibles — periodos unicos con incidencias registradas
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (session.user.role !== 'admin') return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })

  // Obtener solo la fecha de cada incidencia — suficiente para agrupar por mes/ano
  const incidencias = await prisma.incidencia.findMany({
    select: { creado_en: true },
    orderBy: { creado_en: 'asc' }
  })

  // Construir mapa de periodos unicos usando clave "anio-mes" para evitar duplicados
  const periodosMap = new Map<string, Periodo>()
  incidencias.forEach(inc => {
    const d = new Date(inc.creado_en)
    const key = `${d.getFullYear()}-${d.getMonth() + 1}`
    if (!periodosMap.has(key)) {
      periodosMap.set(key, { anio: d.getFullYear(), mes: d.getMonth() + 1 })
    }
  })

  // Ordenar cronologicamente — primero por ano, luego por mes
  const periodos = Array.from(periodosMap.values())
    .sort((a, b) => a.anio !== b.anio ? a.anio - b.anio : a.mes - b.mes)

  return NextResponse.json({ success: true, periodos })
}