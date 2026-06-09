/**
 * app/api/admin/reportes/[id]/route.ts — Aprobacion o rechazo de reportes en revision.
 * Solo accesible para usuarios con rol 'admin'.
 * Delega la logica de negocio a ReporteService (patron Repository).
 *
 * PATCH /api/admin/reportes/[id] — opera segun la accion enviada en el body:
 *
 *   Aprobar: { accion: 'aprobar', categoriaId: number, tecnicoId: number }
 *     Crea la incidencia con la categoria elegida por el admin,
 *     asigna la tarea al tecnico seleccionado y actualiza el estado del reporte.
 *
 *   Rechazar: { accion: 'rechazar' }
 *     Marca el reporte como 'descartado' — desaparece del mapa ciudadano.
 *
 * Usado por: app/admin/components/BandejaRevision.tsx (modal paso 2)
 * Depende de: ReporteService, NextAuth
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../../../lib/auth'
import { ReporteService } from '../../../../lib/services/ReporteService'

// Traduccion de errores del servicio a mensajes legibles para el cliente
const ERRORES: Record<string, { mensaje: string; status: number }> = {
  REPORTE_NO_ENCONTRADO:  { mensaje: 'Reporte no encontrado', status: 404 },
  REPORTE_NO_EN_REVISION: { mensaje: 'El reporte no esta en estado de revision', status: 400 },
}

// PATCH /api/admin/reportes/[id] — aprobar o rechazar un reporte en revision
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (session.user.role !== 'admin') return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })

  const adminId = parseInt(session.user.id)
  const { id } = await params
  const reporteId = parseInt(id)
  const body = await request.json()
  const { accion, categoriaId, tecnicoId } = body

  // Validar accion antes de llamar al servicio
  if (!accion || !['aprobar', 'rechazar'].includes(accion)) {
    return NextResponse.json({ error: 'Accion invalida' }, { status: 400 })
  }

  // Al aprobar, categoria y tecnico son obligatorios — el admin los elige en el modal
  if (accion === 'aprobar' && (!categoriaId || !tecnicoId)) {
    return NextResponse.json(
      { error: 'categoriaId y tecnicoId son obligatorios para aprobar' },
      { status: 400 }
    )
  }

  try {
    if (accion === 'aprobar') {
      // El servicio crea la incidencia, asigna la tarea y actualiza el reporte
      const resultado = await ReporteService.aprobar(reporteId, categoriaId, tecnicoId, adminId)
      return NextResponse.json({ success: true, data: resultado }, { status: 200 })
    } else {
      // El servicio marca el reporte como descartado — ya no aparece en el mapa
      const reporte = await ReporteService.rechazar(reporteId, adminId)
      return NextResponse.json({ success: true, reporte }, { status: 200 })
    }
  } catch (error: any) {
    const err = ERRORES[error.message]
    if (err) return NextResponse.json({ error: err.mensaje }, { status: err.status })
    console.error('Error procesando reporte:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}