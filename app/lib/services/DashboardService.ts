/**
 * DashboardService.ts — Cálculo de KPIs y estadísticas para el panel admin.
 * Patrón: Service — encapsula todas las consultas de métricas del sistema.
 *
 * Responsabilidades:
 *   - Resumen de incidencias por estado
 *   - Tasa de resolución mensual
 *   - Tiempo promedio de resolución por categoría
 *   - Ranking de técnicos por tareas completadas
 *   - Conteo de reportes pendientes de revisión
 *   - Distribución de incidencias por categoría
 *
 * Usado por: app/api/admin/dashboard/route.ts
 * Depende de: prisma
 */

import { prisma } from '../prisma'

export class DashboardService {

  /**
   * Obtiene todos los KPIs del dashboard en una sola llamada.
   * Ejecuta las consultas en paralelo con Promise.all para minimizar latencia.
   */
  static async obtenerKPIs() {
    const ahora = new Date()
    // Inicio y fin del mes actual para calcular métricas mensuales
    const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1)
    const finMes = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 0, 23, 59, 59)

    // Ejecutar todas las consultas en paralelo para mejor rendimiento
    const [
      resumenIncidencias,
      reportesPendientes,
      incidenciasMes,
      tareasCompletadasMes,
      porCategoria,
      rankingTecnicos,
      tiemposResolucion
    ] = await Promise.all([
      // 1. Resumen de incidencias por estado (todas)
      DashboardService.getResumenIncidencias(),
      // 2. Reportes esperando revisión del admin
      DashboardService.getReportesPendientesRevision(),
      // 3. Incidencias creadas este mes
      DashboardService.getIncidenciasMes(inicioMes, finMes),
      // 4. Tareas completadas este mes
      DashboardService.getTareasCompletadasMes(inicioMes, finMes),
      // 5. Distribución de incidencias activas por categoría
      DashboardService.getIncidenciasPorCategoria(),
      // 6. Técnicos ordenados por tareas completadas este mes
      DashboardService.getRankingTecnicos(inicioMes, finMes),
      // 7. Tiempo promedio de resolución por categoría
      DashboardService.getTiemposResolucionPorCategoria(),
    ])

    // Calcular tasa de resolución mensual
    const totalMes = incidenciasMes.total
    const completadasMes = incidenciasMes.completadas
    const tasaResolucion = totalMes > 0
      ? Math.round((completadasMes / totalMes) * 100)
      : 0

    return {
      // Resumen general
      resumenIncidencias,
      reportesPendientesRevision: reportesPendientes,

      // Métricas del mes actual
      mes: {
        periodo: `${ahora.getMonth() + 1}/${ahora.getFullYear()}`,
        totalIncidencias: totalMes,
        completadas: completadasMes,
        tasaResolucion, // porcentaje 0-100
        tareasCompletadas: tareasCompletadasMes,
      },

      // Distribución y tiempos
      porCategoria,
      tiemposResolucion,

      // Ranking de técnicos
      rankingTecnicos,
    }
  }

  /**
   * Cuenta incidencias agrupadas por estado.
   * Muestra la situación actual de todas las incidencias del sistema.
   */
  private static async getResumenIncidencias() {
    const [pendiente, asignado, enCurso, completado] = await Promise.all([
      prisma.incidencia.count({ where: { estado: 'pendiente' } }),
      prisma.incidencia.count({ where: { estado: 'asignado' } }),
      prisma.incidencia.count({ where: { estado: 'en_curso' } }),
      prisma.incidencia.count({ where: { estado: 'completado' } }),
    ])

    return {
      pendiente,   // sin técnico asignado
      asignado,    // técnico asignado, no ha iniciado
      enCurso,     // técnico trabajando
      completado,  // resuelto
      total: pendiente + asignado + enCurso + completado
    }
  }

  /**
   * Cuenta los reportes que están esperando revisión manual del admin.
   */
  private static async getReportesPendientesRevision() {
    return await prisma.reporte.count({
      where: { estado: 'pendiente_revision' }
    })
  }

  /**
   * Cuenta incidencias creadas y completadas en el mes indicado.
   */
  private static async getIncidenciasMes(inicio: Date, fin: Date) {
    const [total, completadas] = await Promise.all([
      prisma.incidencia.count({
        where: { creado_en: { gte: inicio, lte: fin } }
      }),
      prisma.incidencia.count({
        where: {
          creado_en: { gte: inicio, lte: fin },
          estado: 'completado'
        }
      })
    ])
    return { total, completadas }
  }

  /**
   * Cuenta tareas completadas en el mes indicado.
   */
  private static async getTareasCompletadasMes(inicio: Date, fin: Date) {
    return await prisma.tarea.count({
      where: {
        estado: 'completada',
        completada_en: { gte: inicio, lte: fin }
      }
    })
  }

  /**
   * Distribución de incidencias activas (no completadas) por categoría.
   * Útil para identificar qué tipo de problemas son más frecuentes.
   */
  private static async getIncidenciasPorCategoria() {
    const categorias = await prisma.categoria.findMany({
      where: { activo: true },
      select: {
        id: true,
        nombre: true,
        peligrosidad: true,
        _count: {
          select: {
            incidencias: {
              where: { estado: { not: 'completado' } }
            }
          }
        }
      }
    })

    return categorias.map(c => ({
      id: c.id,
      nombre: c.nombre,
      peligrosidad: c.peligrosidad,
      incidenciasActivas: c._count.incidencias
    })).sort((a, b) => b.incidenciasActivas - a.incidenciasActivas)
  }

  /**
   * Ranking de técnicos por tareas completadas en el mes.
   * Permite al admin identificar quién está más activo.
   */
  private static async getRankingTecnicos(inicio: Date, fin: Date) {
    const tecnicos = await prisma.usuario.findMany({
      where: { rol: 'tecnico', activo: true },
      select: {
        id: true,
        nombre: true,
        tareas: {
          where: {
            estado: 'completada',
            completada_en: { gte: inicio, lte: fin }
          },
          select: { id: true }
        }
      }
    })

    return tecnicos
      .map(t => ({
        id: t.id,
        nombre: t.nombre,
        tareasCompletadasMes: t.tareas.length
      }))
      // Ordenar por más tareas completadas primero
      .sort((a, b) => b.tareasCompletadasMes - a.tareasCompletadasMes)
  }

  /**
   * Tiempo promedio de resolución por categoría (en horas).
   * Calcula desde creación de la incidencia hasta completado de la tarea.
   * Solo considera incidencias completadas para el cálculo.
   */
  private static async getTiemposResolucion() {
    const incidencias = await prisma.incidencia.findMany({
      where: { estado: 'completado' },
      include: {
        categoria: { select: { nombre: true } },
        tareas: {
          where: { estado: 'completada' },
          select: { completada_en: true },
          take: 1,
          orderBy: { completada_en: 'desc' }
        }
      }
    })

    // Agrupar tiempos por categoría
    const tiemposPorCategoria: Record<string, number[]> = {}

    for (const inc of incidencias) {
      const tareaCompletada = inc.tareas[0]
      if (!tareaCompletada?.completada_en) continue

      const horas = (tareaCompletada.completada_en.getTime() - inc.creado_en.getTime()) / (1000 * 60 * 60)
      const cat = inc.categoria.nombre

      if (!tiemposPorCategoria[cat]) tiemposPorCategoria[cat] = []
      tiemposPorCategoria[cat].push(horas)
    }

    // Calcular promedio por categoría
    return Object.entries(tiemposPorCategoria).map(([categoria, tiempos]) => ({
      categoria,
      promedioHoras: Math.round((tiempos.reduce((a, b) => a + b, 0) / tiempos.length) * 10) / 10,
      totalCompletadas: tiempos.length
    })).sort((a, b) => a.promedioHoras - b.promedioHoras)
  }

  /**
   * Alias público para getTiemposResolucion — necesario para llamarlo desde obtenerKPIs.
   */
  private static async getTiemposResolucionPorCategoria() {
    return DashboardService.getTiemposResolucion()
  }
}