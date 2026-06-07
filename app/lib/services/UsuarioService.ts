/**
 * UsuarioService.ts — Gestión de usuarios técnicos municipales.
 * Patrón: Repository — encapsula el CRUD de técnicos y sus especialidades.
 *
 * Responsabilidades:
 *   - Crear técnicos con contraseña hasheada
 *   - Editar datos de un técnico
 *   - Activar y desactivar técnicos
 *   - Asignar y quitar especialidades por categoría
 *   - Obtener técnicos disponibles por especialidad (para el modal de asignación)
 *
 * Usado por: app/api/admin/tecnicos/route.ts, app/api/admin/tecnicos/[id]/route.ts
 * Depende de: prisma, bcryptjs
 */

import { prisma } from '../prisma'
import bcrypt from 'bcryptjs'

export class UsuarioService {

  /**
   * Obtiene todos los técnicos del sistema con sus especialidades y tareas activas.
   * Usado por el admin para ver el estado de cada técnico en el panel de gestión.
   */
  static async obtenerTecnicos() {
    return await prisma.usuario.findMany({
      where: { rol: 'tecnico' },
      select: {
        id: true,
        nombre: true,
        email: true,
        rut: true,
        telefono: true,
        activo: true,
        creado_en: true,
        especialidades: {
          include: {
            categoria: {
              select: { id: true, nombre: true }
            }
          }
        },
        // Contar tareas activas para mostrar carga de trabajo actual
        tareas: {
          where: {
            estado: { in: ['asignada', 'aceptada', 'en_curso', 'atrasada'] }
          },
          select: { id: true, estado: true }
        }
      },
      orderBy: { nombre: 'asc' }
    })
  }

  /**
   * Obtiene técnicos disponibles con especialidad en una categoría específica.
   * Usado en el modal de aprobación de reporte para que el admin elija a quién asignar.
   * Incluye cantidad de tareas activas para ayudar al admin a balancear la carga.
   *
   * @param categoriaId - ID de la categoría del problema a asignar
   */
  static async obtenerTecnicosPorEspecialidad(categoriaId: number) {
    return await prisma.usuario.findMany({
      where: {
        rol: 'tecnico',
        activo: true,
        especialidades: {
          some: { categoria_id: categoriaId }
        }
      },
      select: {
        id: true,
        nombre: true,
        email: true,
        // Tareas activas — el admin ve la carga de cada técnico antes de asignar
        tareas: {
          where: {
            estado: { in: ['asignada', 'aceptada', 'en_curso', 'atrasada'] }
          },
          select: { id: true, estado: true }
        }
      },
      orderBy: { nombre: 'asc' }
    })
  }

  /**
   * Crea un nuevo técnico con contraseña hasheada.
   * La contraseña se hashea con bcrypt antes de guardar — nunca se almacena en texto plano.
   *
   * @param nombre    - Nombre completo del técnico
   * @param email     - Email único del técnico (se usa para el login)
   * @param password  - Contraseña en texto plano (se hashea aquí)
   * @param rut       - RUT único del técnico
   * @param telefono  - Teléfono opcional
   */
  static async crear(
    nombre: string,
    email: string,
    password: string,
    rut: string,
    telefono?: string
  ) {
    // Verificar que el email no esté en uso
    const existeEmail = await prisma.usuario.findUnique({ where: { email } })
    if (existeEmail) throw new Error('EMAIL_YA_EXISTE')

    // Verificar que el RUT no esté en uso
    const existeRut = await prisma.usuario.findUnique({ where: { rut } })
    if (existeRut) throw new Error('RUT_YA_EXISTE')

    // Hashear la contraseña con salt 10 antes de guardar
    const password_hash = await bcrypt.hash(password, 10)

    return await prisma.usuario.create({
      data: {
        nombre: nombre.trim(),
        email: email.trim().toLowerCase(),
        password_hash,
        rut: rut.trim(),
        telefono: telefono?.trim() ?? null,
        rol: 'tecnico',
        activo: true
      },
      select: {
        id: true,
        nombre: true,
        email: true,
        rut: true,
        telefono: true,
        activo: true,
        creado_en: true
      }
    })
  }

  /**
   * Edita los datos de un técnico existente.
   * No permite cambiar el rol ni el RUT una vez creado.
   * Si se envía nueva contraseña, se hashea antes de guardar.
   *
   * @param tecnicoId  - ID del técnico a editar
   * @param datos      - Campos a actualizar (todos opcionales)
   */
  static async editar(
    tecnicoId: number,
    datos: {
      nombre?: string
      email?: string
      telefono?: string
      password?: string
    }
  ) {
    const tecnico = await prisma.usuario.findUnique({ where: { id: tecnicoId } })
    if (!tecnico) throw new Error('TECNICO_NO_ENCONTRADO')

    // Si cambia el email, verificar que no esté en uso por otro usuario
    if (datos.email && datos.email !== tecnico.email) {
      const existeEmail = await prisma.usuario.findUnique({
        where: { email: datos.email }
      })
      if (existeEmail) throw new Error('EMAIL_YA_EXISTE')
    }

    // Preparar los datos a actualizar
    const dataUpdate: Record<string, unknown> = {}
    if (datos.nombre) dataUpdate.nombre = datos.nombre.trim()
    if (datos.email) dataUpdate.email = datos.email.trim().toLowerCase()
    if (datos.telefono !== undefined) dataUpdate.telefono = datos.telefono?.trim() ?? null
    // Si se envía nueva contraseña, hashearla antes de guardar
    if (datos.password) dataUpdate.password_hash = await bcrypt.hash(datos.password, 10)

    return await prisma.usuario.update({
      where: { id: tecnicoId },
      data: dataUpdate,
      select: {
        id: true,
        nombre: true,
        email: true,
        rut: true,
        telefono: true,
        activo: true
      }
    })
  }

  /**
   * Desactiva un técnico — no lo elimina de la BD para mantener historial.
   * Un técnico desactivado no puede iniciar sesión ni recibir nuevas tareas.
   * Si tiene tareas activas, el admin deberá cancelarlas manualmente primero.
   *
   * @param tecnicoId - ID del técnico a desactivar
   */
  static async desactivar(tecnicoId: number) {
    const tecnico = await prisma.usuario.findUnique({ where: { id: tecnicoId } })
    if (!tecnico) throw new Error('TECNICO_NO_ENCONTRADO')
    if (!tecnico.activo) throw new Error('TECNICO_YA_INACTIVO')

    // Verificar si tiene tareas activas antes de desactivar
    const tareasActivas = await prisma.tarea.count({
      where: {
        tecnico_id: tecnicoId,
        estado: { in: ['asignada', 'aceptada', 'en_curso', 'atrasada'] }
      }
    })
    if (tareasActivas > 0) throw new Error('TECNICO_TIENE_TAREAS_ACTIVAS')

    return await prisma.usuario.update({
      where: { id: tecnicoId },
      data: { activo: false },
      select: { id: true, nombre: true, activo: true }
    })
  }

  /**
   * Reactiva un técnico previamente desactivado.
   *
   * @param tecnicoId - ID del técnico a reactivar
   */
  static async activar(tecnicoId: number) {
    const tecnico = await prisma.usuario.findUnique({ where: { id: tecnicoId } })
    if (!tecnico) throw new Error('TECNICO_NO_ENCONTRADO')
    if (tecnico.activo) throw new Error('TECNICO_YA_ACTIVO')

    return await prisma.usuario.update({
      where: { id: tecnicoId },
      data: { activo: true },
      select: { id: true, nombre: true, activo: true }
    })
  }

  /**
   * Asigna una especialidad a un técnico.
   * Usa @@unique([usuario_id, categoria_id]) del schema para evitar duplicados.
   *
   * @param tecnicoId   - ID del técnico
   * @param categoriaId - ID de la categoría a asignar
   */
  static async asignarEspecialidad(tecnicoId: number, categoriaId: number) {
    const tecnico = await prisma.usuario.findUnique({ where: { id: tecnicoId } })
    if (!tecnico) throw new Error('TECNICO_NO_ENCONTRADO')

    const categoria = await prisma.categoria.findUnique({ where: { id: categoriaId } })
    if (!categoria) throw new Error('CATEGORIA_NO_ENCONTRADA')

    // Verificar si ya tiene esa especialidad
    const yaExiste = await prisma.especialidad.findUnique({
      where: {
        usuario_id_categoria_id: { usuario_id: tecnicoId, categoria_id: categoriaId }
      }
    })
    if (yaExiste) throw new Error('ESPECIALIDAD_YA_ASIGNADA')

    return await prisma.especialidad.create({
      data: { usuario_id: tecnicoId, categoria_id: categoriaId }
    })
  }

  /**
   * Quita una especialidad a un técnico.
   *
   * @param tecnicoId   - ID del técnico
   * @param categoriaId - ID de la categoría a quitar
   */
  static async quitarEspecialidad(tecnicoId: number, categoriaId: number) {
    const especialidad = await prisma.especialidad.findUnique({
      where: {
        usuario_id_categoria_id: { usuario_id: tecnicoId, categoria_id: categoriaId }
      }
    })
    if (!especialidad) throw new Error('ESPECIALIDAD_NO_ENCONTRADA')

    return await prisma.especialidad.delete({
      where: {
        usuario_id_categoria_id: { usuario_id: tecnicoId, categoria_id: categoriaId }
      }
    })
  }
}