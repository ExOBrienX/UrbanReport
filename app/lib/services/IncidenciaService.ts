import { prisma } from '../prisma'
import { HaversineService } from './HaversineService'
import { PriorityService } from './PriorityService'

export class IncidenciaService {

  // Busca técnicos disponibles con especialidad en la categoría
  // y crea la tarea visible para todos ellos (sin tecnico_id)
  private static async crearTareaParaEspecialistas(incidenciaId: number, categoriaId: number) {
    // Verificar si ya existe una tarea activa para esta incidencia
    const tareaActiva = await prisma.tarea.findFirst({
      where: {
        incidencia_id: incidenciaId,
        estado: { in: ['asignada', 'aceptada', 'en_curso', 'atrasada'] }
      }
    })

    if (tareaActiva) {
      console.log('ℹ️ Ya existe tarea activa para incidencia:', incidenciaId)
      return null
    }

    // Verificar que existan técnicos activos con esa especialidad
    const tecnicosConEspecialidad = await prisma.usuario.count({
      where: {
        rol: 'tecnico',
        activo: true,
        especialidades: {
          some: { categoria_id: categoriaId }
        }
      }
    })

    if (tecnicosConEspecialidad === 0) {
      console.warn('⚠️ No hay técnicos con especialidad en categoría:', categoriaId)
      return null
    }

    // Crear tarea sin tecnico_id — visible para todos con esa especialidad
    const tarea = await prisma.tarea.create({
      data: {
        incidencia_id: incidenciaId,
        estado: 'asignada'
        // tecnico_id omitido intencionalmente — se asigna cuando alguien acepta
      }
    })

    console.log('✅ Tarea creada:', tarea.id, '| Para especialidad categoría:', categoriaId)
    return tarea
  }

  static async crearOActualizar(categoriaId: number, latitud: number, longitud: number, reporteId: number) {
    const radioKm = await HaversineService.getRadioAgrupacion(categoriaId)
    const cercanas = await HaversineService.findNearbyIncidences(latitud, longitud, categoriaId, radioKm)

    // ── Duplicado: incidencia existente cercana ──────────────────────────────
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

      // Si el duplicado aumenta prioridad pero no tiene tarea activa, crear una
      await this.crearTareaParaEspecialistas(cercanas[0].id, categoriaId)

      return { incidencia, esDuplicado: true, prioridad }
    }

    // ── Nueva incidencia ─────────────────────────────────────────────────────
    const incidencia = await prisma.incidencia.create({
      data: {
        categoria_id: categoriaId,
        latitud,
        longitud,
        estado: 'asignado', // asignado porque se creará tarea
        contador_reportes: 1
      }
    })

    await prisma.reporte.update({
      where: { id: reporteId },
      data: { incidencia_id: incidencia.id }
    })

    const prioridad = await PriorityService.recalcularPrioridad(incidencia.id)

    // Crear tarea para los técnicos con esa especialidad
    const tarea = await this.crearTareaParaEspecialistas(incidencia.id, categoriaId)

    // Si no se pudo crear tarea (sin técnicos), la incidencia queda pendiente
    if (!tarea) {
      await prisma.incidencia.update({
        where: { id: incidencia.id },
        data: { estado: 'pendiente' }
      })
    }

    return { incidencia, esDuplicado: false, prioridad }
  }
}