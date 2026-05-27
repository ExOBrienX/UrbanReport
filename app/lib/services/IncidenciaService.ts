/**
 * IncidenciaService.ts — Gestión de incidencias urbanas y asignación de tareas.
 * Patrón: Service + Repository — orquesta la lógica de negocio entre reportes,
 * incidencias y tareas, delegando a HaversineService y PriorityService.
 *
 * Flujo principal:
 * 1. Cuando la IA aprueba un reporte, route.ts llama a crearOActualizar()
 * 2. Se buscan incidencias cercanas con Haversine (posibles duplicados)
 * 3. Si hay duplicado → se agrupa al existente y recalcula prioridad
 * 4. Si es nuevo → se crea incidencia y se genera tarea para técnicos
 *
 * Usado por: app/api/reports/route.ts
 * Depende de: HaversineService.ts, PriorityService.ts, prisma
 */

import { prisma } from '../prisma'
import { HaversineService } from './HaversineService'
import { PriorityService } from './PriorityService'

export class IncidenciaService {

  /**
   * Crea una tarea para una incidencia, visible para todos los técnicos
   * con especialidad en la categoría correspondiente (cola compartida).
   * La tarea se crea sin tecnico_id — el primero que la acepte se la asigna.
   *
   * Método privado — solo lo usa crearOActualizar() dentro de esta clase.
   *
   * @param incidenciaId - ID de la incidencia que necesita atención
   * @param categoriaId  - ID de la categoría para filtrar técnicos con esa especialidad
   * @returns La tarea creada, o null si ya existe una activa o no hay técnicos
   */
  private static async crearTareaParaEspecialistas(incidenciaId: number, categoriaId: number) {

    // Evitar crear tarea duplicada si ya existe una activa para esta incidencia
    // Estados activos: asignada, aceptada, en_curso, atrasada
    const tareaActiva = await prisma.tarea.findFirst({
      where: {
        incidencia_id: incidenciaId,
        estado: { in: ['asignada', 'aceptada', 'en_curso', 'atrasada'] }
      }
    })

    // Si ya hay tarea activa, no crear otra — una incidencia tiene una sola tarea activa
    if (tareaActiva) {
      console.log('ℹ️ Ya existe tarea activa para incidencia:', incidenciaId)
      return null
    }

    // Verificar que haya al menos un técnico activo con especialidad en esta categoría
    // Si no hay técnicos, la incidencia quedará en 'pendiente' para asignación manual del admin
    const tecnicosConEspecialidad = await prisma.usuario.count({
      where: {
        rol: 'tecnico',
        activo: true,
        especialidades: {
          some: { categoria_id: categoriaId } // al menos una especialidad en esta categoría
        }
      }
    })

    if (tecnicosConEspecialidad === 0) {
      console.warn('⚠️ No hay técnicos con especialidad en categoría:', categoriaId)
      return null
    }

    // Crear tarea sin tecnico_id — aparece en la cola de TODOS los técnicos
    // con esta especialidad. El primero que la acepte se la asigna.
    const tarea = await prisma.tarea.create({
      data: {
        incidencia_id: incidenciaId,
        tecnico_id: null,  // null = disponible para cualquier técnico con la especialidad
        estado: 'asignada' // estado inicial — nadie la ha tomado aún
      }
    })

    console.log('✅ Tarea creada:', tarea.id, '| Para especialidad categoría:', categoriaId)
    return tarea
  }

  /**
   * Crea una nueva incidencia o agrupa el reporte a una existente cercana (duplicado).
   * Es el método central del flujo de procesamiento de reportes aprobados por la IA.
   *
   * @param categoriaId - ID de la categoría detectada por la IA
   * @param latitud     - Coordenada del reporte
   * @param longitud    - Coordenada del reporte
   * @param reporteId   - ID del reporte para vincularlo a la incidencia
   * @returns Objeto con la incidencia, si es duplicado y la prioridad calculada
   */
  static async crearOActualizar(categoriaId: number, latitud: number, longitud: number, reporteId: number) {

    // Obtener el radio de agrupación configurado para esta categoría (en km)
    // Ejemplo: Veredas = 30m = 0.030 km
    const radioKm = await HaversineService.getRadioAgrupacion(categoriaId)

    // Buscar incidencias activas de la misma categoría dentro del radio
    // Usa la fórmula Haversine para calcular distancias reales sobre la Tierra
    const cercanas = await HaversineService.findNearbyIncidences(latitud, longitud, categoriaId, radioKm)

    // ── CASO 1: Duplicado — hay incidencias cercanas de la misma categoría ──
    if (cercanas.length > 0) {
      // Tomar la incidencia más cercana (cercanas está ordenado por distancia)
      const incidencia = await prisma.incidencia.update({
        where: { id: cercanas[0].id },
        // Incrementar el contador de reportes — más reportes = mayor prioridad
        data: { contador_reportes: { increment: 1 }, actualizado_en: new Date() }
      })

      // Vincular el reporte a esta incidencia existente
      await prisma.reporte.update({
        where: { id: reporteId },
        data: { incidencia_id: cercanas[0].id }
      })

      // Recalcular prioridad con el nuevo contador de reportes
      const prioridad = await PriorityService.recalcularPrioridad(cercanas[0].id)

      // Si por alguna razón no había tarea activa (ej: fue cancelada), crear una nueva
      await this.crearTareaParaEspecialistas(cercanas[0].id, categoriaId)

      return { incidencia, esDuplicado: true, prioridad }
    }

    // ── CASO 2: Nueva incidencia — no hay duplicados en el radio ────────────
    const incidencia = await prisma.incidencia.create({
      data: {
        categoria_id: categoriaId,
        latitud,
        longitud,
        estado: 'asignado', // asumimos que habrá técnico; se corrige abajo si no hay
        contador_reportes: 1
      }
    })

    // Vincular el reporte a la nueva incidencia
    await prisma.reporte.update({
      where: { id: reporteId },
      data: { incidencia_id: incidencia.id }
    })

    // Calcular prioridad inicial basada en peligrosidad de la categoría
    const prioridad = await PriorityService.recalcularPrioridad(incidencia.id)

    // Intentar crear tarea para técnicos con la especialidad correspondiente
    const tarea = await this.crearTareaParaEspecialistas(incidencia.id, categoriaId)

    // Si no se pudo crear tarea (no hay técnicos disponibles),
    // cambiar estado a 'pendiente' para que el admin la asigne manualmente
    if (!tarea) {
      await prisma.incidencia.update({
        where: { id: incidencia.id },
        data: { estado: 'pendiente' }
      })
    }

    return { incidencia, esDuplicado: false, prioridad }
  }
}