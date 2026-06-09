/**
 * TareaService.ts — Gestión de tareas de técnicos municipales.
 * Patrón: Repository — encapsula toda la lógica de acceso a datos de tareas,
 * desacoplando los endpoints API de la lógica de negocio.
 *
 * Responsabilidades:
 *   - Obtener la cola de tareas de un técnico según su especialidad
 *   - Cambiar el estado de una tarea (aceptar, iniciar, atraso, completar)
 *   - Completar una tarea con foto de evidencia
 *   - Cancelar una tarea (solo admin) y devolver incidencia a pendiente
 *   - Crear una tarea urgente manual (solo admin)
 *   - Sincronizar el estado de la incidencia asociada
 *   - Registrar cada cambio en historial_estados
 *
 * Usado por: app/api/tasks/route.ts, app/api/tasks/[id]/route.ts,
 *            app/api/admin/tareas/route.ts, app/api/admin/tareas/[id]/route.ts
 * Depende de: PriorityService, uploadEvidencia, prisma
 */

import { prisma } from '../prisma'
import { PriorityService } from './PriorityService'
import { uploadEvidencia } from '../uploadEvidencia'

const MOTIVOS_ATRASO_VALIDOS = ['materiales', 'complejidad', 'clima', 'otro']

export class TareaService {

  /**
   * Obtiene la cola de tareas para un técnico autenticado.
   * Incluye tareas disponibles (sin técnico asignado) de su especialidad
   * y sus propias tareas activas, ordenadas por prioridad descendente.
   */
  static async obtenerPorTecnico(tecnicoId: number) {
    const especialidades = await prisma.especialidad.findMany({
      where: { usuario_id: tecnicoId },
      select: { categoria_id: true }
    })
    const categoriaIds = especialidades.map(e => e.categoria_id)

    if (categoriaIds.length === 0) return []

    const todasTareas = await prisma.tarea.findMany({
      where: {
        OR: [
          {
            estado: 'asignada',
            incidencia: {
              categoria_id: { in: categoriaIds },
              estado: { not: 'completado' }
            }
          },
          {
            tecnico_id: tecnicoId,
            estado: { in: ['aceptada', 'en_curso', 'atrasada'] }
          }
        ]
      },
      include: {
        incidencia: {
          include: {
            categoria: true,
            reportes: {
              take: 1,
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
        incidencia: { puntaje_prioridad: 'desc' }
      }
    })

    return todasTareas.filter(t =>
      t.tecnico_id === null || t.tecnico_id === tecnicoId
    )
  }

  /**
   * Cambia el estado de una tarea según la acción del técnico.
   * Valida que la transición sea válida, sincroniza la incidencia
   * y registra el cambio en historial_estados.
   */
  static async cambiarEstado(
    tareaId: number,
    tecnicoId: number,
    accion: string,
    motivoAtraso?: string
  ) {
    const tarea = await prisma.tarea.findUnique({
      where: { id: tareaId },
      include: { incidencia: true }
    })

    if (!tarea) throw new Error('TAREA_NO_ENCONTRADA')

    if (accion !== 'aceptar' && tarea.tecnico_id !== tecnicoId) {
      throw new Error('SIN_PERMISO')
    }

    let nuevoEstadoTarea: string
    let nuevoEstadoIncidencia: string
    let datosExtra: Record<string, unknown> = {}

    switch (accion) {
      case 'aceptar':
        if (tarea.estado !== 'asignada') throw new Error('TAREA_YA_ACEPTADA')
        const tareaActiva = await prisma.tarea.findFirst({
          where: {
            tecnico_id: tecnicoId,
            estado: { in: ['aceptada', 'en_curso', 'atrasada'] }
          }
        })
        if (tareaActiva) throw new Error('YA_TIENE_TAREA_ACTIVA')
        nuevoEstadoTarea = 'aceptada'
        nuevoEstadoIncidencia = 'asignado'
        datosExtra = { tecnico_id: tecnicoId }
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
        nuevoEstadoIncidencia = 'en_curso'
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

    const tareaActualizada = await prisma.tarea.update({
      where: { id: tareaId },
      data: { estado: nuevoEstadoTarea as any, ...datosExtra }
    })

    await prisma.incidencia.update({
      where: { id: tarea.incidencia_id },
      data: { estado: nuevoEstadoIncidencia as any }
    })

    await prisma.historialEstado.create({
      data: {
        tarea_id: tareaId,
        estado_anterior: tarea.estado as any,
        estado_nuevo: nuevoEstadoTarea as any,
        cambiado_por_id: tecnicoId
      }
    })

    await PriorityService.recalcularPrioridad(tarea.incidencia_id)

    console.log(`✅ Tarea ${tareaId}: ${tarea.estado} → ${nuevoEstadoTarea}`)
    return tareaActualizada
  }

  /**
   * Completa una tarea subiendo la foto de evidencia a Cloudflare R2.
   * La foto es obligatoria — sin evidencia no se puede completar.
   */
  static async completarConEvidencia(tareaId: number, tecnicoId: number, foto: File) {
    const tarea = await prisma.tarea.findUnique({ where: { id: tareaId } })

    if (!tarea) throw new Error('TAREA_NO_ENCONTRADA')
    if (tarea.tecnico_id !== tecnicoId) throw new Error('SIN_PERMISO')

    const arrayBuffer = await foto.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    if (buffer.length > 8 * 1024 * 1024) throw new Error('FOTO_DEMASIADO_GRANDE')

    const fotoParaSubir = new File([buffer], foto.name || 'evidencia.jpg', { type: foto.type })
    const fotoUrl = await uploadEvidencia(fotoParaSubir)

    const tareaActualizada = await prisma.tarea.update({
      where: { id: tareaId },
      data: {
        foto_evidencia_url: fotoUrl,
        estado: 'completada',
        completada_en: new Date()
      }
    })

    await prisma.incidencia.update({
      where: { id: tarea.incidencia_id },
      data: { estado: 'completado' }
    })

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

  /**
   * El admin cancela una tarea ya asignada.
   * El motivo de cancelación es obligatorio según RF-19.
   * La incidencia vuelve a estado 'pendiente' para ser reasignada.
   *
   * @param tareaId          - ID de la tarea a cancelar
   * @param adminId          - ID del admin que cancela (para historial)
   * @param motivoCancelacion - Motivo obligatorio de la cancelación
   */
  static async cancelar(tareaId: number, adminId: number, motivoCancelacion: string) {
    if (!motivoCancelacion?.trim()) throw new Error('MOTIVO_CANCELACION_REQUERIDO')

    const tarea = await prisma.tarea.findUnique({
      where: { id: tareaId },
      include: { incidencia: true }
    })

    if (!tarea) throw new Error('TAREA_NO_ENCONTRADA')

    // Solo se pueden cancelar tareas activas — no tiene sentido cancelar una completada
    const estadosCancelables = ['asignada', 'aceptada', 'en_curso', 'atrasada']
    if (!estadosCancelables.includes(tarea.estado)) {
      throw new Error('TAREA_NO_CANCELABLE')
    }

    // Cancelar la tarea registrando el motivo y quién la canceló
    const tareaActualizada = await prisma.tarea.update({
      where: { id: tareaId },
      data: {
        estado: 'cancelada',
        motivo_cancelacion: motivoCancelacion.trim(),
        cancelada_por_id: adminId
      }
    })

    // Devolver la incidencia a 'pendiente' para que pueda ser reasignada
    await prisma.incidencia.update({
      where: { id: tarea.incidencia_id },
      data: { estado: 'pendiente' }
    })

    // Registrar en historial para trazabilidad
    await prisma.historialEstado.create({
      data: {
        tarea_id: tareaId,
        estado_anterior: tarea.estado as any,
        estado_nuevo: 'cancelada',
        cambiado_por_id: adminId
      }
    })

    console.log(`✅ Tarea ${tareaId} cancelada por admin ${adminId}`)
    return tareaActualizada
  }

  /**
   * El admin crea una tarea urgente manual sin pasar por el flujo ciudadano ni la IA.
   * Útil para emergencias detectadas directamente por el municipio (RF-21).
   * La tarea se asigna directamente al técnico elegido por el admin.
   *
   * @param categoriaId - Categoría de la incidencia
   * @param latitud     - Coordenada del problema
   * @param longitud    - Coordenada del problema
   * @param descripcion - Descripción del problema por el admin
   * @param tecnicoId   - Técnico al que se asignará directamente
   * @param adminId     - Admin que crea la tarea (para trazabilidad)
   */
  static async crearUrgente(
    categoriaId: number,
    latitud: number,
    longitud: number,
    descripcion: string,
    tecnicoId: number,
    adminId: number
  ) {
    // Verificar que la categoría exista y esté activa
    const categoria = await prisma.categoria.findUnique({
      where: { id: categoriaId, activo: true }
    })
    if (!categoria) throw new Error('CATEGORIA_NO_ENCONTRADA')

    // Verificar que el técnico exista y esté activo
    const tecnico = await prisma.usuario.findUnique({
      where: { id: tecnicoId, activo: true, rol: 'tecnico' }
    })
    if (!tecnico) throw new Error('TECNICO_NO_ENCONTRADO')

    // Crear la incidencia urgente directamente sin pasar por Haversine ni IA
    const incidencia = await prisma.incidencia.create({
      data: {
        categoria_id: categoriaId,
        latitud,
        longitud,
        estado: 'asignado',
        contador_reportes: 1
      }
    })

    // Calcular prioridad inicial
    const prioridad = await PriorityService.recalcularPrioridad(incidencia.id)

    // Crear la tarea asignada directamente al técnico elegido por el admin
    const tarea = await prisma.tarea.create({
      data: {
        incidencia_id: incidencia.id,
        tecnico_id: tecnicoId,  // asignación directa, no cola compartida
        estado: 'asignada'
      }
    })

    console.log(`✅ Tarea urgente ${tarea.id} creada por admin ${adminId} → técnico ${tecnicoId}`)
    return { tarea, incidencia, prioridad }
  }
  /**
   * Asigna un técnico a una incidencia que está en estado 'pendiente' sin tarea activa.
   * Se usa cuando la IA aprobó un reporte pero no había técnicos disponibles,
   * o cuando el admin cancela una tarea y quiere reasignar manualmente.
   *
   * @param incidenciaId - ID de la incidencia pendiente sin técnico
   * @param tecnicoId    - ID del técnico a asignar
   * @param adminId      - ID del admin que realiza la asignación
   */
  static async asignarAIncidenciaExistente(incidenciaId: number, tecnicoId: number, adminId: number) {
    // Verificar que la incidencia existe y está pendiente
    const incidencia = await prisma.incidencia.findUnique({
      where: { id: incidenciaId }
    })
    if (!incidencia) throw new Error('INCIDENCIA_NO_ENCONTRADA')

    // Verificar que no tenga ya una tarea activa
    const tareaActiva = await prisma.tarea.findFirst({
      where: {
        incidencia_id: incidenciaId,
        estado: { in: ['asignada', 'aceptada', 'en_curso', 'atrasada'] }
      }
    })
    if (tareaActiva) throw new Error('YA_TIENE_TAREA_ACTIVA')

    // Verificar que el técnico existe y está activo
    const tecnico = await prisma.usuario.findUnique({
      where: { id: tecnicoId, activo: true, rol: 'tecnico' }
    })
    if (!tecnico) throw new Error('TECNICO_NO_ENCONTRADO')

    // Crear tarea asignada directamente al técnico
    const tarea = await prisma.tarea.create({
      data: {
        incidencia_id: incidenciaId,
        tecnico_id: tecnicoId,
        estado: 'asignada'
      }
    })

    // Actualizar estado de la incidencia a 'asignado'
    await prisma.incidencia.update({
      where: { id: incidenciaId },
      data: { estado: 'asignado' }
    })

    // Recalcular prioridad con el nuevo estado
    await PriorityService.recalcularPrioridad(incidenciaId)

    console.log(`✅ Técnico ${tecnicoId} asignado a incidencia ${incidenciaId} por admin ${adminId}`)
    return { tarea, incidencia: { id: incidenciaId, estado: 'asignado' } }
  }
}