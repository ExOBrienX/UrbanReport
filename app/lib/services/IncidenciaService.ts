import { prisma } from '../prisma'
import { HaversineService } from './HaversineService'
import { PriorityService } from './PriorityService'

export class IncidenciaService {
  static async crearOActualizar(categoriaId: number, latitud: number, longitud: number, reporteId: number) {
    const radioKm = await HaversineService.getRadioAgrupacion(categoriaId)
    const cercanas = await HaversineService.findNearbyIncidences(latitud, longitud, categoriaId, radioKm)

    if (cercanas.length > 0) {
      const incidencia = await prisma.incidencia.update({
        where: { id: cercanas[0].id },
        data: { contador_reportes: { increment: 1 }, actualizado_en: new Date() }
      })

      await prisma.reporte.update({
        where: { id: reporteId },
        data: { incidencia_id: cercanas[0].id }
      })

      const prioridad = await PriorityService.recalcularPrioridad(cercanas[0].id)

      return { incidencia, esDuplicado: true, prioridad }
    }

    const incidencia = await prisma.incidencia.create({
      data: { categoria_id: categoriaId, latitud, longitud, estado: 'pendiente', contador_reportes: 1 }
    })

    await prisma.reporte.update({
      where: { id: reporteId },
      data: { incidencia_id: incidencia.id }
    })

    const prioridad = await PriorityService.recalcularPrioridad(incidencia.id)

    return { incidencia, esDuplicado: false, prioridad }
  }
}