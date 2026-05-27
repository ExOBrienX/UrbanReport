/**
 * Patrón Factory — centraliza la construcción de respuestas de la API.
 * Cada método retorna { body, status } listo para usar en NextResponse.json().
 * Usado principalmente en: app/api/reports/route.ts
 */

// ResultadoIA: interfaz del análisis de Claude Haiku (AIService.ts)
import { ResultadoIA } from '../services/AIService'
// Reporte: tipo generado por Prisma según schema.prisma
import { Reporte } from '@prisma/client'

// Datos de la incidencia que se retornan al frontend cuando un reporte es aprobado
export interface IncidenciaResumen {
  id: number           // ID de la incidencia en BD
  esDuplicado: boolean // true si se agrupó a una incidencia existente cercana
  estado: string       // 'pendiente' | 'asignado' | 'en_curso' | 'completado'
  prioridad: number    // puntaje 0-100 calculado por PriorityService
}

// Todos los métodos son estáticos — se llaman directamente sin instanciar la clase
// Ejemplo: ResponseFactory.error('msg') en vez de new ResponseFactory().error('msg')
export class ResponseFactory {

  // Error interno del servidor — status 500 por defecto, configurable
  static error(mensaje: string, status: number = 500) {
    return { body: { error: mensaje }, status }
  }

  // Error de validación — datos incorrectos enviados por el usuario (status 400)
  static validacion(mensaje: string) {
    return { body: { error: mensaje }, status: 400 }
  }

  // IA rechazó el reporte (imagen inválida, no municipal, incoherente)
  // status 200 porque el servidor funcionó bien — el rechazo es un resultado esperado
  // El frontend lee 'rechazado: true' para mostrar el modal de rechazo al ciudadano
  static reporteRechazado(motivo: string) {
    return {
      body: {
        success: false,   // indica al frontend que el reporte no fue aceptado
        rechazado: true,  // activa el modal de rechazo en ReportModal.tsx
        motivo,           // mensaje legible que verá el ciudadano
      },
      status: 200
    }
  }

  // IA tuvo baja confianza — reporte va a bandeja de revisión del admin
  // El ciudadano ve éxito para evitar reenvíos; el admin lo revisará manualmente
  static reporteEnRevision() {
    return {
      body: {
        success: true,
        necesitaRevision: true,
      },
      status: 200
    }
  }

  // IA aprobó el reporte — incidencia creada/actualizada automáticamente
  // Incluye el resumen de la incidencia para que el frontend pueda mostrarlo
  static reporteAprobado(incidencia: IncidenciaResumen) {
    return {
      body: {
        success: true,
        necesitaRevision: false,
        incidencia, // datos de la incidencia generada (id, prioridad, etc.)
      },
      status: 200
    }
  }

  // Respuesta del GET /api/reports — lista de reportes para el mapa ciudadano
  static reporteListado(reportes: Reporte[]) {
    return {
      body: { success: true, reportes },
      status: 200
    }
  }

  // La IA falló técnicamente (timeout, error de conexión, JSON inválido)
  // Diferencia con reporteEnRevision: aquí la IA no pudo procesar, no es baja confianza
  // El resultado para el ciudadano y admin es el mismo — va a revisión manual
  static fallo_ia() {
    return {
      body: {
        success: true,
        necesitaRevision: true,
      },
      status: 200
    }
  }
}