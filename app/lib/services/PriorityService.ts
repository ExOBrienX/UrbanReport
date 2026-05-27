/**
 * PriorityService.ts — Motor de cálculo de prioridad de incidencias.
 * Patrón: Strategy — encapsula el algoritmo de priorización como una
 * estrategia intercambiable. Si se necesita cambiar la fórmula o los
 * pesos, solo se modifica este archivo sin tocar el resto del sistema.
 *
 * La prioridad determina el orden en que los técnicos ven las tareas
 * en su cola — mayor puntaje = aparece primero.
 *
 * Usado por: IncidenciaService.ts, app/api/tasks/[id]/route.ts
 */

import { prisma } from '../prisma'

export class PriorityService {

  /**
   * Pesos de cada variable en la fórmula de prioridad.
   * La suma de todos los pesos debe ser igual a 1.0 (100%).
   *
   * private: solo se usa dentro de esta clase.
   * readonly: no puede modificarse en tiempo de ejecución.
   */
  private static readonly PESOS = {
    peligrosidad:      0.4,  // 40% — qué tan peligroso es el problema (definido por categoría)
    duplicados:        0.25, // 25% — cuántos ciudadanos reportaron el mismo problema
    diasSinResolucion: 0.2,  // 20% — hace cuánto se reportó sin resolverse
    zonaAltoTransito:  0.15, // 15% — si está en zona de alta afluencia (futuro)
  }

  /**
   * Calcula el puntaje de prioridad (0-100) a partir de 4 variables.
   * Cada variable se normaliza al rango [0, 1] antes de aplicar el peso,
   * para que todas contribuyan de forma proporcional al resultado final.
   *
   * @param peligrosidad       - Nivel de peligro de la categoría (0-100, viene de BD)
   * @param duplicados         - Cantidad de reportes del mismo problema
   * @param diasSinResolucion  - Días transcurridos desde el primer reporte
   * @param esZonaAltoTransito - Si está en zona concurrida (actualmente siempre false)
   * @returns Puntaje entero entre 0 y 100
   */
  static calculatePriority(
    peligrosidad: number,
    duplicados: number,
    diasSinResolucion: number,
    esZonaAltoTransito: boolean
  ): number {

    // Normalizar cada variable al rango [0, 1] usando Math.min para no superar 1
    const normPeligrosidad = Math.min(peligrosidad / 100, 1)  // 100 = máximo peligro
    const normDuplicados   = Math.min(duplicados / 20, 1)     // 20 reportes = máximo
    const normDias         = Math.min(diasSinResolucion / 30, 1) // 30 días = máximo
    const normZona         = esZonaAltoTransito ? 1 : 0.5     // zona normal = 0.5

    // Sumar cada variable normalizada multiplicada por su peso correspondiente
    // El resultado es un valor entre 0 y 1
    const score =
      normPeligrosidad * this.PESOS.peligrosidad +
      normDuplicados   * this.PESOS.duplicados +
      normDias         * this.PESOS.diasSinResolucion +
      normZona         * this.PESOS.zonaAltoTransito

    // Convertir a escala 0-100 y redondear al entero más cercano
    return Math.round(score * 100)
  }

  /**
   * Recalcula y guarda la prioridad de una incidencia específica en BD.
   * Se llama cada vez que cambia algo que afecta la prioridad:
   *   - Al crear una incidencia nueva
   *   - Al agregar un reporte duplicado
   *   - Al cambiar el estado de una tarea
   *
   * @param incidenciaId - ID de la incidencia a recalcular
   * @returns El nuevo puntaje de prioridad calculado
   */
  static async recalcularPrioridad(incidenciaId: number): Promise<number> {

    // Obtener la incidencia junto con su categoría (necesaria para la peligrosidad)
    const incidencia = await prisma.incidencia.findUnique({
      where: { id: incidenciaId },
      include: { categoria: true } // JOIN con tabla categorias para obtener peligrosidad
    })

    if (!incidencia) throw new Error(`Incidencia ${incidenciaId} no encontrada`)

    // Calcular días transcurridos desde que se creó la incidencia hasta hoy
    // getTime() retorna milisegundos → dividir para convertir a días
    const diasSinResolucion = Math.floor(
      (new Date().getTime() - incidencia.creado_en.getTime()) / (1000 * 60 * 60 * 24)
    )

    // Calcular el puntaje usando los datos actuales de la incidencia
    const prioridad = this.calculatePriority(
      incidencia.categoria.peligrosidad, // peligrosidad definida por categoría en BD
      incidencia.contador_reportes,      // cuántos reportes tiene agrupados
      diasSinResolucion,                 // días sin resolver
      false                              // zonaAltoTransito: pendiente de implementar
    )

    // Guardar el nuevo puntaje en BD para que las queries puedan ordenar por él
    await prisma.incidencia.update({
      where: { id: incidenciaId },
      data: { puntaje_prioridad: prioridad, actualizado_en: new Date() }
    })

    return prioridad
  }
}