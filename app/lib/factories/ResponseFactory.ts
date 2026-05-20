// Patrón Factory — centraliza la construcción de objetos de respuesta de la API
// El route no necesita conocer la estructura interna de cada tipo de respuesta

import { ResultadoIA } from '../services/AIService'
import { Reporte } from '@prisma/client'

export interface IncidenciaResumen {
  id: number
  esDuplicado: boolean
  estado: string
  prioridad: number
}

export class ResponseFactory {

  static error(mensaje: string, status: number = 500) {
    return { body: { error: mensaje }, status }
  }

  static validacion(mensaje: string) {
    return { body: { error: mensaje }, status: 400 }
  }

  static reporteRechazado(motivo: string) {
    return {
      body: {
        success: false,
        rechazado: true,
        motivo,
      },
      status: 200
    }
  }

  static reporteEnRevision() {
    return {
      body: {
        success: true,
        necesitaRevision: true,
      },
      status: 200
    }
  }

  static reporteAprobado(incidencia: IncidenciaResumen) {
    return {
      body: {
        success: true,
        necesitaRevision: false,
        incidencia,
      },
      status: 200
    }
  }

  static reporteListado(reportes: Reporte[]) {
    return {
      body: { success: true, reportes },
      status: 200
    }
  }

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