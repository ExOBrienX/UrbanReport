/**
 * app/api/admin/informes/route.ts — Generacion de informe mensual con IA (RF-24).
 * Solo accesible para usuarios con rol 'admin'.
 * Delega la generacion del informe a AIService.
 *
 * POST /api/admin/informes — genera un informe ejecutivo del periodo indicado.
 *   Body: { mes: number (1-12), anio: number }
 *
 *   El servicio consulta las incidencias del mes en BD, calcula estadisticas
 *   por categoria y envia el contexto a Claude Haiku para generar el informe
 *   en lenguaje natural orientado a la toma de decisiones municipal.
 *
 * Usado por: app/admin/components/InformeMensual.tsx
 * Depende de: AIService, NextAuth
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../../lib/auth'
import { AIService } from '../../../lib/services/AIService'

// POST /api/admin/informes — generar informe mensual con Claude Haiku
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (session.user.role !== 'admin') return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })

  const body = await request.json()
  const { mes, anio } = body

  // Validar rango de mes antes de llamar al servicio
  if (!mes || !anio || mes < 1 || mes > 12) {
    return NextResponse.json(
      { error: 'mes (1-12) y anio son obligatorios' },
      { status: 400 }
    )
  }

  try {
    console.log(`Generando informe mensual ${mes}/${anio}...`)
    // El servicio calcula estadisticas del mes y genera el texto con la IA
    const informe = await AIService.generarInformeMensual(mes, anio)
    return NextResponse.json({ success: true, informe }, { status: 200 })
  } catch (error) {
    console.error('Error generando informe:', error)
    return NextResponse.json({ error: 'Error al generar el informe' }, { status: 500 })
  }
}