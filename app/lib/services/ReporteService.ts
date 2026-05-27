/**
 * ReporteService.ts — Gestión de reportes ciudadanos.
 * Patrón: Repository — abstrae el acceso a datos de reportes,
 * desacoplando la lógica de negocio del ORM Prisma.
 *
 * Responsabilidades:
 *   - Crear un reporte inicial cuando el ciudadano lo envía
 *   - Obtener reportes activos para mostrar en el mapa
 *
 * Usado por: app/api/reports/route.ts
 * Depende de: prisma, uploadPhoto
 */

import { prisma } from '../prisma'
import { uploadPhoto } from '../uploadPhoto'

export class ReporteService {

  /**
   * Crea un nuevo reporte en la base de datos con estado inicial 'pendiente_revision'.
   * La foto se sube a Cloudflare R2 antes de llamar a este método.
   * Los campos categoria_ia_id y resumen_ia se actualizan después por la IA.
   *
   * @param foto        - Archivo de imagen enviado por el ciudadano
   * @param descripcion - Texto descriptivo del problema
   * @param latitud     - Coordenada geográfica del problema
   * @param longitud    - Coordenada geográfica del problema
   * @param fotoUrl     - URL ya procesada de R2 (opcional — si no se pasa, se sube la foto aquí)
   */
  static async crear(
    foto: File,
    descripcion: string,
    latitud: number,
    longitud: number,
    fotoUrl?: string
  ) {
    // Si ya se subió la foto antes (en route.ts), usar esa URL directamente.
    // El operador ?? significa "si fotoUrl es null o undefined, ejecutar uploadPhoto".
    // Se evita doble lectura del buffer del archivo File.
    const urlFinal = fotoUrl ?? await uploadPhoto(foto)

    // Crear el registro en MySQL — estado inicial siempre es 'pendiente_revision'
    // porque la IA aún no ha procesado el reporte
    const reporte = await prisma.reporte.create({
      data: {
        descripcion,
        foto_url: urlFinal,
        latitud,
        longitud,
        estado: 'pendiente_revision',
        // categoria_ia_id y resumen_ia quedan null hasta que la IA procese el reporte
      },
    })

    return reporte
  }

  /**
   * Obtiene todos los reportes activos para mostrarlos en el mapa ciudadano.
   * Excluye los reportes descartados (rechazados por IA o admin).
   * Incluye el estado de la incidencia asociada para mostrar el color correcto
   * en el mapa (la burbuja refleja el estado del trabajo, no del reporte).
   */
  static async obtenerActivos() {
    const reportes = await prisma.reporte.findMany({
      where: {
        // Mostrar todos excepto los descartados — el ciudadano no debe ver reportes rechazados
        estado: { not: 'descartado' }
      },
      select: {
        id: true,
        latitud: true,
        longitud: true,
        estado: true,          // estado del proceso de validación (pendiente, asignado, etc.)
        descripcion: true,
        foto_url: true,
        creado_en: true,
        categoria_ia_id: true, // categoría detectada por la IA
        resumen_ia: true,      // resumen técnico generado por la IA
        incidencia_id: true,   // ID de la incidencia agrupadora (si existe)
        confianza_ia: true,    // nivel de confianza de la IA (0-100)
        incidencia: {
          select: {
            // El estado de la incidencia es el que se muestra en el mapa:
            // pendiente=rojo, asignado/en_curso=naranja, completado=verde
            estado: true
          }
        }
      }
    })

    return reportes
  }
}