/**
 * ReporteService.ts — Gestión de reportes ciudadanos.
 * Patrón: Repository — abstrae el acceso a datos de reportes,
 * desacoplando la lógica de negocio del ORM Prisma.
 *
 * Responsabilidades:
 *   - Crear un reporte inicial cuando el ciudadano lo envía
 *   - Obtener reportes activos para mostrar en el mapa
 *   - Obtener reportes pendientes de revisión para el admin
 *   - Aprobar o rechazar reportes manualmente (admin)
 *
 * Usado por: app/api/reports/route.ts, app/api/admin/reportes/
 * Depende de: prisma, uploadPhoto, IncidenciaService
 */

import { prisma } from '../prisma'
import { uploadPhoto } from '../uploadPhoto'
import { IncidenciaService } from './IncidenciaService'

export class ReporteService {

  /**
   * Crea un nuevo reporte en la base de datos con estado inicial 'pendiente_revision'.
   * La foto se sube a Cloudflare R2 antes de llamar a este método.
   * Los campos categoria_ia_id y resumen_ia se actualizan después por la IA.
   */
  static async crear(
    foto: File,
    descripcion: string,
    latitud: number,
    longitud: number,
    fotoUrl?: string
  ) {
    const urlFinal = fotoUrl ?? await uploadPhoto(foto)

    const reporte = await prisma.reporte.create({
      data: {
        descripcion,
        foto_url: urlFinal,
        latitud,
        longitud,
        estado: 'pendiente_revision',
      },
    })

    return reporte
  }

  /**
   * Obtiene todos los reportes activos para mostrarlos en el mapa ciudadano.
   * Excluye los reportes descartados (rechazados por IA o admin).
   * Incluye el estado de la incidencia asociada para mostrar el color correcto en el mapa.
   */
  static async obtenerActivos() {
    const reportes = await prisma.reporte.findMany({
      where: {
        estado: { not: 'descartado' }
      },
      select: {
        id: true,
        latitud: true,
        longitud: true,
        estado: true,
        descripcion: true,
        foto_url: true,
        creado_en: true,
        categoria_ia_id: true,
        resumen_ia: true,
        incidencia_id: true,
        confianza_ia: true,
        incidencia: {
          select: { estado: true }
        }
      }
    })

    return reportes
  }

  /**
   * Obtiene todos los reportes en estado 'pendiente_revision' para la bandeja del admin.
   * Incluye la categoría detectada por la IA y el nivel de confianza para que el admin
   * pueda tomar una decisión informada de aprobar o rechazar.
   */
  static async obtenerPendientesRevision() {
    return await prisma.reporte.findMany({
      where: { estado: 'pendiente_revision' },
      select: {
        id: true,
        descripcion: true,
        foto_url: true,
        latitud: true,
        longitud: true,
        confianza_ia: true,
        resumen_ia: true,
        creado_en: true,
        // Categoría sugerida por la IA — el admin puede cambiarla al aprobar
        categoria_ia: {
          select: { id: true, nombre: true }
        }
      },
      // Más antiguos primero — priorizar los que llevan más tiempo sin revisión
      orderBy: { creado_en: 'asc' }
    })
  }

  /**
   * El admin aprueba un reporte manualmente.
   * Crea la incidencia y la tarea asignada al técnico elegido por el admin.
   * Si el admin cambió la categoría sugerida por la IA, se usa la nueva.
   *
   * @param reporteId  - ID del reporte a aprobar
   * @param categoriaId - ID de la categoría confirmada por el admin
   * @param tecnicoId   - ID del técnico al que se asignará la tarea
   * @param adminId     - ID del admin que aprueba (para historial)
   */
  static async aprobar(reporteId: number, categoriaId: number, tecnicoId: number, adminId: number) {
    const reporte = await prisma.reporte.findUnique({
      where: { id: reporteId }
    })

    if (!reporte) throw new Error('REPORTE_NO_ENCONTRADO')
    if (reporte.estado !== 'pendiente_revision') throw new Error('REPORTE_NO_EN_REVISION')

    // Actualizar el reporte a estado 'pendiente' con la categoría confirmada por el admin
    await prisma.reporte.update({
      where: { id: reporteId },
      data: {
        estado: 'pendiente',
        categoria_ia_id: categoriaId
      }
    })

    // Crear la incidencia y tarea — igual que el flujo automático de la IA
    // pero con el técnico específico elegido por el admin
    const lat = Number(reporte.latitud)
    const lon = Number(reporte.longitud)

    const incidenciaResult = await IncidenciaService.crearOActualizar(
      categoriaId, lat, lon, reporteId
    )

    // Si el admin eligió un técnico específico, asignar la tarea directamente a él
    // en vez de dejarla disponible para cualquier técnico de la especialidad
    if (incidenciaResult && !incidenciaResult.esDuplicado) {
      await prisma.tarea.updateMany({
        where: {
          incidencia_id: incidenciaResult.incidencia.id,
          tecnico_id: null,
          estado: 'asignada'
        },
        data: { tecnico_id: tecnicoId }
      })
    }

    return incidenciaResult
  }

  /**
   * El admin rechaza un reporte manualmente.
   * El reporte queda como 'descartado' y desaparece del mapa ciudadano.
   *
   * @param reporteId - ID del reporte a rechazar
   * @param adminId   - ID del admin que rechaza (para trazabilidad)
   */
  static async rechazar(reporteId: number, adminId: number) {
    const reporte = await prisma.reporte.findUnique({
      where: { id: reporteId }
    })

    if (!reporte) throw new Error('REPORTE_NO_ENCONTRADO')
    if (reporte.estado !== 'pendiente_revision') throw new Error('REPORTE_NO_EN_REVISION')

    return await prisma.reporte.update({
      where: { id: reporteId },
      data: { estado: 'descartado' }
    })
  }
}