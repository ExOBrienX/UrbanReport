import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../../lib/auth'
import { prisma } from '../../../lib/prisma'
import { PriorityService } from '../../../lib/services/PriorityService'
import { uploadEvidencia } from '../../../lib/uploadEvidencia'

// PATCH /api/tasks/[id] — cambiar estado de una tarea
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)

  if (!session) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
  if (session.user.role !== 'tecnico') {
    return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })
  }

  const tecnicoId = parseInt(session.user.id)
  const { id } = await params
  const tareaId = parseInt(id)
  const body = await request.json()
  const { accion, motivo_atraso } = body

  const acciones = ['aceptar', 'iniciar', 'atraso', 'completar']
  if (!accion || !acciones.includes(accion)) {
    return NextResponse.json({ error: 'Acción inválida' }, { status: 400 })
  }

  try {
    const tarea = await prisma.tarea.findUnique({
      where: { id: tareaId },
      include: { incidencia: true }
    })

    if (!tarea) {
      return NextResponse.json({ error: 'Tarea no encontrada' }, { status: 404 })
    }

    // Verificar que la tarea le pertenece o está disponible
    if (accion !== 'aceptar' && tarea.tecnico_id !== tecnicoId) {
      return NextResponse.json({ error: 'No tienes permiso sobre esta tarea' }, { status: 403 })
    }

    let nuevoEstadoTarea: string
    let nuevoEstadoIncidencia: string
    let datosExtra: Record<string, unknown> = {}

    switch (accion) {
      case 'aceptar':
        if (tarea.estado !== 'asignada') {
          return NextResponse.json({ error: 'La tarea ya fue aceptada' }, { status: 400 })
        }
        // Verificar que no tenga otra tarea activa
        const tareaActiva = await prisma.tarea.findFirst({
          where: {
            tecnico_id: tecnicoId,
            estado: { in: ['aceptada', 'en_curso', 'atrasada'] }
          }
        })
        if (tareaActiva) {
          return NextResponse.json({ error: 'Ya tienes una tarea activa' }, { status: 400 })
        }
        nuevoEstadoTarea = 'aceptada'
        nuevoEstadoIncidencia = 'asignado'
        datosExtra = { tecnico_id: tecnicoId }
        break

      case 'iniciar':
        if (tarea.estado !== 'aceptada') {
          return NextResponse.json({ error: 'Debes aceptar la tarea primero' }, { status: 400 })
        }
        nuevoEstadoTarea = 'en_curso'
        nuevoEstadoIncidencia = 'en_curso'
        break

      case 'atraso':
        if (!['en_curso', 'aceptada'].includes(tarea.estado)) {
          return NextResponse.json({ error: 'Solo puedes reportar atraso en tareas activas' }, { status: 400 })
        }
        const motivosValidos = ['materiales', 'complejidad', 'clima', 'otro']
        if (!motivo_atraso || !motivosValidos.includes(motivo_atraso)) {
          return NextResponse.json({ error: 'Debes seleccionar un motivo de atraso válido' }, { status: 400 })
        }
        nuevoEstadoTarea = 'atrasada'
        nuevoEstadoIncidencia = 'en_curso'
        datosExtra = { motivo_atraso }
        break

      case 'completar':
        if (!['en_curso', 'atrasada', 'aceptada'].includes(tarea.estado)) {
          return NextResponse.json({ error: 'No puedes completar esta tarea en su estado actual' }, { status: 400 })
        }
        nuevoEstadoTarea = 'completada'
        nuevoEstadoIncidencia = 'completado'
        datosExtra = { completada_en: new Date() }
        break

      default:
        return NextResponse.json({ error: 'Acción no reconocida' }, { status: 400 })
    }

    // Actualizar tarea
    const tareaActualizada = await prisma.tarea.update({
      where: { id: tareaId },
      data: {
        estado: nuevoEstadoTarea as any,
        ...datosExtra
      }
    })

    // Actualizar incidencia
    await prisma.incidencia.update({
      where: { id: tarea.incidencia_id },
      data: { estado: nuevoEstadoIncidencia as any }
    })

    // Registrar en historial
    await prisma.historialEstado.create({
      data: {
        tarea_id: tareaId,
        estado_anterior: tarea.estado as any,
        estado_nuevo: nuevoEstadoTarea as any,
        cambiado_por_id: tecnicoId
      }
    })

    // Recalcular prioridad
    await PriorityService.recalcularPrioridad(tarea.incidencia_id)

    console.log(`✅ Tarea ${tareaId}: ${tarea.estado} → ${nuevoEstadoTarea}`)

    return NextResponse.json({
      success: true,
      tarea: tareaActualizada
    }, { status: 200 })

  } catch (error) {
    console.error('Error actualizando tarea:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

// POST /api/tasks/[id] — subir foto de evidencia al completar
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)

  if (!session) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
  if (session.user.role !== 'tecnico') {
    return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })
  }

  const tecnicoId = parseInt(session.user.id)
  const { id } = await params
  const tareaId = parseInt(id)

  try {
    const tarea = await prisma.tarea.findUnique({ where: { id: tareaId } })

    if (!tarea) {
      return NextResponse.json({ error: 'Tarea no encontrada' }, { status: 404 })
    }
    if (tarea.tecnico_id !== tecnicoId) {
      return NextResponse.json({ error: 'No tienes permiso sobre esta tarea' }, { status: 403 })
    }

    const formData = await request.formData()
    const foto = formData.get('foto') as File | null

    if (!foto) {
      return NextResponse.json({ error: 'La foto de evidencia es obligatoria' }, { status: 400 })
    }

    // Validar tipo y tamaño
    const tiposPermitidos = ['image/jpeg', 'image/png', 'image/webp']
    if (!tiposPermitidos.includes(foto.type)) {
      return NextResponse.json({ error: 'Solo se permiten imágenes JPG, PNG o WebP' }, { status: 400 })
    }

    const arrayBuffer = await foto.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    if (buffer.length > 8 * 1024 * 1024) {
      return NextResponse.json({ error: 'La foto no puede superar 8MB' }, { status: 400 })
    }

    const fotoParaSubir = new File([buffer], foto.name || 'evidencia.jpg', { type: foto.type })
    const fotoUrl = await uploadEvidencia(fotoParaSubir)

    // Actualizar tarea con foto y marcar como completada
    const tareaActualizada = await prisma.tarea.update({
      where: { id: tareaId },
      data: {
        foto_evidencia_url: fotoUrl,
        estado: 'completada',
        completada_en: new Date()
      }
    })

    // Actualizar incidencia a completado
    await prisma.incidencia.update({
      where: { id: tarea.incidencia_id },
      data: { estado: 'completado' }
    })

    // Registrar en historial
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

    return NextResponse.json({
      success: true,
      tarea: tareaActualizada,
      foto_url: fotoUrl
    }, { status: 200 })

  } catch (error) {
    console.error('Error subiendo evidencia:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}