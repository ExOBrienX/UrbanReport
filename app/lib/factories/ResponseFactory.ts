/**
 * ResponseFactory.ts — Patrón Factory para construcción de respuestas API.
 * Centraliza el formato de todas las respuestas HTTP del sistema,
 * garantizando consistencia en estructura, códigos de estado y mensajes.
 *
 * Patrón: Factory Method — cada método estático construye un tipo específico
 * de respuesta sin exponer la lógica de construcción al caller.
 *
 * Usado por: todos los route.ts de app/api/
 * No depende de ningún otro módulo del sistema.
 */

import { ResultadoIA } from '../services/AIService'
import { Reporte } from '@prisma/client'

// Datos de la incidencia retornados al frontend cuando un reporte es aprobado
export interface IncidenciaResumen {
  id: number           // ID de la incidencia en BD
  esDuplicado: boolean // true si se agrupó a una incidencia existente cercana
  estado: string       // 'pendiente' | 'asignado' | 'en_curso' | 'completado'
  prioridad: number    // puntaje 0-100 calculado por PriorityService
}

export class ResponseFactory {

  // ── Respuestas genéricas — usadas por todos los endpoints ─────────────────

  /**
   * Respuesta exitosa genérica.
   * @param data   - Objeto con los datos a retornar (se fusiona con { success: true })
   * @param status - Código HTTP (200 por defecto, 201 para creación)
   */
  static success(data: object, status: number = 200) {
    return { body: { success: true, ...data }, status }
  }

  /**
   * Error interno del servidor — fallo inesperado no controlado.
   * @param mensaje - Mensaje técnico (por defecto genérico para no exponer detalles)
   * @param status  - Código HTTP (500 por defecto)
   */
  static error(mensaje: string = 'Error interno del servidor', status: number = 500) {
    return { body: { error: mensaje }, status }
  }

  /**
   * Error de validación — datos incorrectos o faltantes en el request.
   * Siempre retorna status 400.
   */
  static validacion(mensaje: string) {
    return { body: { error: mensaje }, status: 400 }
  }

  /**
   * Recurso no encontrado en BD.
   * @param recurso - Nombre del recurso (ej: 'Tecnico', 'Tarea', 'Reporte')
   */
  static notFound(recurso: string) {
    return { body: { error: `${recurso} no encontrado` }, status: 404 }
  }

  /**
   * Sin autenticación — sesión inexistente o expirada.
   * Siempre retorna status 401.
   */
  static unauthorized() {
    return { body: { error: 'No autorizado' }, status: 401 }
  }

  /**
   * Sin permiso — usuario autenticado pero sin el rol requerido.
   * Siempre retorna status 403.
   */
  static forbidden() {
    return { body: { error: 'Acceso denegado' }, status: 403 }
  }

  /**
   * Error semántico del servicio — traduce errores de negocio a HTTP.
   * @param errores - Mapa de código de error a { mensaje, status }
   * @param codigo  - Código lanzado por el servicio (error.message)
   * @param fallback - Mensaje de fallback si el código no está en el mapa
   */
  static serviceError(
    errores: Record<string, { mensaje: string; status: number }>,
    codigo: string,
    fallback: string = 'Error interno del servidor'
  ) {
    const err = errores[codigo]
    if (err) return { body: { error: err.mensaje }, status: err.status }
    return { body: { error: fallback }, status: 500 }
  }

  // ── Respuestas específicas del flujo de reportes ciudadanos ───────────────

  /**
   * IA rechazó el reporte — imagen inválida, no municipal o incoherente.
   * Status 200 porque el servidor funcionó correctamente.
   * El frontend lee 'rechazado: true' para mostrar el modal al ciudadano.
   */
  static reporteRechazado(motivo: string) {
    return {
      body: { success: false, rechazado: true, motivo },
      status: 200
    }
  }

  /**
   * IA tuvo baja confianza — reporte va a bandeja de revisión del admin.
   * El ciudadano ve éxito para evitar reenvíos duplicados.
   */
  static reporteEnRevision() {
    return {
      body: { success: true, necesitaRevision: true },
      status: 200
    }
  }

  /**
   * IA aprobó el reporte — incidencia creada o actualizada automáticamente.
   * Incluye resumen de la incidencia para que el frontend lo muestre.
   */
  static reporteAprobado(incidencia: IncidenciaResumen) {
    return {
      body: { success: true, necesitaRevision: false, incidencia },
      status: 200
    }
  }

  /**
   * Listado de reportes activos para el mapa ciudadano.
   */
  static reporteListado(reportes: Reporte[]) {
    return {
      body: { success: true, reportes },
      status: 200
    }
  }

  /**
   * Fallo técnico de la IA — timeout, error de conexión o JSON inválido.
   * Distinto de reporteEnRevision: aquí la IA no pudo procesar, no es baja confianza.
   * El resultado para el ciudadano y admin es el mismo — va a revisión manual.
   */
  static falloIA() {
    return {
      body: { success: true, necesitaRevision: true },
      status: 200
    }
  }
}