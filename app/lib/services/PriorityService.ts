import { prisma } from '../prisma'

export class PriorityService {
  private static readonly PESOS = {
    peligrosidad: 0.4,
    duplicados: 0.25,
    diasSinResolucion: 0.2,
    zonaAltoTransito: 0.15,
  }

  static calculatePriority(peligrosidad: number, duplicados: number, diasSinResolucion: number, esZonaAltoTransito: boolean): number {
    const normPeligrosidad = Math.min(peligrosidad / 100, 1)
    const normDuplicados = Math.min(duplicados / 20, 1)
    const normDias = Math.min(diasSinResolucion / 30, 1)
    const normZona = esZonaAltoTransito ? 1 : 0.5

    const score =
      normPeligrosidad * this.PESOS.peligrosidad +
      normDuplicados * this.PESOS.duplicados +
      normDias * this.PESOS.diasSinResolucion +
      normZona * this.PESOS.zonaAltoTransito

    return Math.round(score * 100)
  }

  static async recalcularPrioridad(incidenciaId: number): Promise<number> {
    const incidencia = await prisma.incidencia.findUnique({
      where: { id: incidenciaId },
      include: { categoria: true }
    })

    if (!incidencia) throw new Error(`Incidencia ${incidenciaId} no encontrada`)

    const diasSinResolucion = Math.floor(
      (new Date().getTime() - incidencia.creado_en.getTime()) / (1000 * 60 * 60 * 24)
    )

    const prioridad = this.calculatePriority(
      incidencia.categoria.peligrosidad,
      incidencia.contador_reportes,
      diasSinResolucion,
      false
    )

    await prisma.incidencia.update({
      where: { id: incidenciaId },
      data: { puntaje_prioridad: prioridad, actualizado_en: new Date() }
    })

    return prioridad
  }
}