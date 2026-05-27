/**
 * TareaService.ts — Gestión de tareas de técnicos municipales.
 * Patrón: Repository — encapsula toda la lógica de acceso a datos de tareas,
 * desacoplando los endpoints API de la lógica de negocio.
 *
 * Responsabilidades:
 *   - Obtener la cola de tareas de un técnico según su especialidad
 *   - Cambiar el estado de una tarea (aceptar, iniciar, atraso, completar)
 *   - Completar una tarea con foto de evidencia
 *   - Sincronizar el estado de la incidencia asociada
 *   - Registrar cada cambio en historial_estados
 *
 * Usado por: app/api/tasks/route.ts, app/api/tasks/[id]/route.ts
 * Depende de: PriorityService, uploadEvidencia, prisma
 */

import { prisma } from '../prisma'
import { PriorityService } from './PriorityService'
import { uploadEvidencia } from '../uploadEvidencia'

// Motivos de atraso válidos — deben coincidir con el enum MotivoAtraso en schema.prisma
const MOTIVOS_ATRASO_VALIDOS = ['materiales', 'complejidad', 'clima', 'otro']

export class TareaService {

  /**
   * Obtiene la cola de tareas para un técnico autenticado.
   * Incluye tareas disponibles (sin técnico asignado) de su especialidad
   * y sus propias tareas activas, ordenadas por prioridad descendente.
   *
   * @param tecnicoId - ID del técnico autenticado
   * @returns Lista de tareas con sus incidencias y reportes asociados
   */
  static async obtenerPorTecnico(tecnicoId: number) {
    // Obtener las categorías en que tiene especialidad el técnico
    const especialidades = await prisma.especialidad.findMany({
      where: { usuario_id: tecnicoId },
      select: { categoria_id: true }
    })
    const categoriaIds = especialidades.map(e => e.categoria_id)

    // Si no tiene especialidades asignadas, retornar lista vacía
    if (categoriaIds.length === 0) return []

    // Obtener tareas candidatas — disponibles de su especialidad + sus propias activas
    // El filtro tecnico_id === null se hace en memoria por limitación de tipos en Prisma
    const todasTareas = await prisma.tarea.findMany({
      where: {
        OR: [
          {
            // Tareas disponibles: sin técnico asignado, de su especialidad, incidencia activa
            estado: 'asignada',
            incidencia: {
              categoria_id: { in: categoriaIds },
              estado: { not: 'completado' }
            }
          },
          {
            // Sus propias tareas activas ya aceptadas
            tecnico_id: tecnicoId,
            estado: { in: ['aceptada', 'en_curso', 'atrasada'] }
          }
        ]
      },
      include: {
        incidencia: {
          include: {
            categoria: true, // para mostrar nombre e ícono en la tarjeta
            reportes: {
              take: 1,                       // solo el reporte más reciente
              orderBy: { creado_en: 'desc' },
              select: {
                foto_url: true,
                descripcion: true,
                resumen_ia: true,
                creado_en: true
              }
            }
          }
        }
      },
      orderBy: {
        incidencia: { puntaje_prioridad: 'desc' } // mayor prioridad primero
      }
    })

    // Filtrar en memoria: descartar tareas tomadas por otro técnico
    return todasTareas.filter(t =>
      t.tecnico_id === null || t.tecnico_id === tecnicoId
    )
  }

  /**
   * Cambia el estado de una tarea según la acción del técnico.
   * Valida que la transición sea válida, sincroniza la incidencia
   * y registra el cambio en historial_estados.
   *
   * @param tareaId   - ID de la tarea a actualizar
   * @param tecnicoId - ID del técnico que ejecuta la acción
   * @param accion    - Acción a realizar: 'aceptar' | 'iniciar' | 'atraso' | 'completar'
   * @param motivoAtraso - Motivo requerido solo para accion === 'atraso'
   */
  static async cambiarEstado(
    tareaId: number,
    tecnicoId: number,
    accion: string,
    motivoAtraso?: string
  ) {
    // Obtener la tarea con su incidencia para validar permisos y estado
    const tarea = await prisma.tarea.findUnique({
      where: { id: tareaId },
      include: { incidencia: true }
    })

    if (!tarea) throw new Error('TAREA_NO_ENCONTRADA')

    // Solo 'aceptar' está disponible para cualquier técnico con la especialidad.
    // El resto de acciones requieren ser el dueño de la tarea.
    if (accion !== 'aceptar' && tarea.tecnico_id !== tecnicoId) {
      throw new Error('SIN_PERMISO')
    }

    let nuevoEstadoTarea: string
    let nuevoEstadoIncidencia: string
    let datosExtra: Record<string, unknown> = {}

    switch (accion) {
      case 'aceptar':
        if (tarea.estado !== 'asignada') throw new Error('TAREA_YA_ACEPTADA')

        // Un técnico solo puede tener una tarea activa a la vez
        const tareaActiva = await prisma.tarea.findFirst({
          where: {
            tecnico_id: tecnicoId,
            estado: { in: ['aceptada', 'en_curso', 'atrasada'] }
          }
        })
        if (tareaActiva) throw new Error('YA_TIENE_TAREA_ACTIVA')

        nuevoEstadoTarea = 'aceptada'
        nuevoEstadoIncidencia = 'asignado'
        datosExtra = { tecnico_id: tecnicoId } // asignar el técnico que la tomó
        break

      case 'iniciar':
        if (tarea.estado !== 'aceptada') throw new Error('DEBE_ACEPTAR_PRIMERO')
        nuevoEstadoTarea = 'en_curso'
        nuevoEstadoIncidencia = 'en_curso'
        break

      case 'atraso':
        if (!['en_curso', 'aceptada'].includes(tarea.estado)) throw new Error('ESTADO_INVALIDO_ATRASO')
        if (!motivoAtraso || !MOTIVOS_ATRASO_VALIDOS.includes(motivoAtraso)) {
          throw new Error('MOTIVO_ATRASO_INVALIDO')
        }
        nuevoEstadoTarea = 'atrasada'
        nuevoEstadoIncidencia = 'en_curso' // la incidencia sigue en curso aunque haya atraso
        datosExtra = { motivo_atraso: motivoAtraso }
        break

      case 'completar':
        if (!['en_curso', 'atrasada', 'aceptada'].includes(tarea.estado)) {
          throw new Error('ESTADO_INVALIDO_COMPLETAR')
        }
        nuevoEstadoTarea = 'completada'
        nuevoEstadoIncidencia = 'completado'
        datosExtra = { completada_en: new Date() }
        break

      default:
        throw new Error('ACCION_INVALIDA')
    }

    // Actualizar tarea — spread agrega tecnico_id, motivo_atraso o completada_en según acción
    const tareaActualizada = await prisma.tarea.update({
      where: { id: tareaId },
      data: { estado: nuevoEstadoTarea as any, ...datosExtra }
    })

    // Sincronizar estado de la incidencia con el de la tarea
    await prisma.incidencia.update({
      where: { id: tarea.incidencia_id },
      data: { estado: nuevoEstadoIncidencia as any }
    })

    // Registrar el cambio para trazabilidad y auditoría
    await prisma.historialEstado.create({
      data: {
        tarea_id: tareaId,
        estado_anterior: tarea.estado as any,
        estado_nuevo: nuevoEstadoTarea as any,
        cambiado_por_id: tecnicoId
      }
    })

    // Recalcular prioridad — días sin resolución y estado afectan el puntaje
    await PriorityService.recalcularPrioridad(tarea.incidencia_id)

    console.log(`✅ Tarea ${tareaId}: ${tarea.estado} → ${nuevoEstadoTarea}`)
    return tareaActualizada
  }

  /**
   * Completa una tarea subiendo la foto de evidencia a Cloudflare R2.
   * La foto es obligatoria — sin evidencia no se puede completar.
   *
   * @param tareaId   - ID de la tarea a completar
   * @param tecnicoId - ID del técnico dueño de la tarea
   * @param foto      - Archivo de imagen como evidencia del trabajo terminado
   */
  static async completarConEvidencia(tareaId: number, tecnicoId: number, foto: File) {
    const tarea = await prisma.tarea.findUnique({ where: { id: tareaId } })

    if (!tarea) throw new Error('TAREA_NO_ENCONTRADA')
    if (tarea.tecnico_id !== tecnicoId) throw new Error('SIN_PERMISO')

    // Leer buffer una sola vez para validar tamaño y subir
    const arrayBuffer = await foto.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Límite de 8MB — suficiente para fotos de alta gama post-compresión del canvas
    if (buffer.length > 8 * 1024 * 1024) throw new Error('FOTO_DEMASIADO_GRANDE')

    // Subir evidencia a R2 en carpeta 'evidencias/' separada de los reportes ciudadanos
    const fotoParaSubir = new File([buffer], foto.name || 'evidencia.jpg', { type: foto.type })
    const fotoUrl = await uploadEvidencia(fotoParaSubir)

    // Marcar tarea como completada con la URL de la evidencia
    const tareaActualizada = await prisma.tarea.update({
      where: { id: tareaId },
      data: {
        foto_evidencia_url: fotoUrl,
        estado: 'completada',
        completada_en: new Date()
      }
    })

    // El problema fue resuelto — actualizar la incidencia
    await prisma.incidencia.update({
      where: { id: tarea.incidencia_id },
      data: { estado: 'completado' }
    })

    // Registrar en historial para trazabilidad
    await prisma.historialEstado.create({
      data: {
        tarea_id: tareaId,
        estado_anterior: tarea.estado as any,
        estado_nuevo: 'completada',
        cambiado_por_id: tecnicoId
      }
    })

    await PriorityService.recalcularPrioridad(tarea.incidencia_id)

    console.log(`✅ Tarea ${tareaId} completada con evidencia`)
    return { tarea: tareaActualizada, fotoUrl }
  }
}