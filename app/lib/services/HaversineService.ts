/**
 * HaversineService.ts — Cálculo de distancias geográficas y detección de duplicados.
 * Patrón: Service — encapsula la lógica geoespacial usada para agrupar reportes cercanos.
 * Usado por: IncidenciaService.ts
 *
 * ¿Qué es Haversine?
 * Es una fórmula matemática que calcula la distancia entre dos puntos
 * en la superficie de una esfera (la Tierra) usando sus coordenadas
 * de latitud y longitud. Es más precisa que la distancia euclidiana
 * simple porque considera la curvatura de la Tierra.
 */

import { prisma } from '../prisma'

// Estructura que representa una incidencia cercana al reporte nuevo,
// incluyendo la distancia calculada en kilómetros
export interface NearbyIncidence {
  id: number
  categoria_id: number
  latitud: number
  longitud: number
  estado: string
  puntaje_prioridad: number
  contador_reportes: number
  distancia_km: number // distancia desde el nuevo reporte hasta esta incidencia
}

export class HaversineService {

  /**
   * Calcula la distancia en kilómetros entre dos coordenadas geográficas.
   * Usa la fórmula de Haversine para considerar la curvatura terrestre.
   *
   * @param lat1, lon1 - Coordenadas del punto de origen (nuevo reporte)
   * @param lat2, lon2 - Coordenadas del punto de destino (incidencia existente)
   * @returns Distancia en kilómetros
   */
  static calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371 // Radio de la Tierra en kilómetros

    // Convertir la diferencia de latitud y longitud de grados a radianes
    // (las funciones trigonométricas de JS trabajan en radianes, no grados)
    const dLat = (lat2 - lat1) * (Math.PI / 180)
    const dLon = (lon2 - lon1) * (Math.PI / 180)

    // Fórmula de Haversine:
    // Calcula el cuadrado de la mitad de la longitud de la cuerda entre los puntos
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) *
      Math.sin(dLon/2) * Math.sin(dLon/2)

    // atan2 convierte el resultado a un ángulo central, multiplicado por el radio
    // da la distancia real sobre la superficie terrestre
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
  }

  /**
   * Busca incidencias existentes cercanas al nuevo reporte.
   * Se usa para detectar si el reporte es un duplicado de un problema ya registrado.
   * Solo busca incidencias de la misma categoría que no estén completadas.
   *
   * @param latitud, longitud - Coordenadas del nuevo reporte
   * @param categoriaId       - ID de la categoría detectada por la IA
   * @param radioKm           - Radio máximo de búsqueda en kilómetros
   * @returns Lista de incidencias cercanas ordenadas por distancia (más cercana primero)
   */
  static async findNearbyIncidences(latitud: number, longitud: number, categoriaId: number, radioKm: number): Promise<NearbyIncidence[]> {
    // Obtener todas las incidencias activas de la misma categoría
    // No filtramos por distancia en la query porque MySQL no soporta Haversine nativo
    const incidencias = await prisma.incidencia.findMany({
      where: {
        categoria_id: categoriaId,
        estado: { not: 'completado' } // excluir incidencias ya resueltas
      },
      select: {
        id: true, categoria_id: true, latitud: true, longitud: true,
        estado: true, puntaje_prioridad: true, contador_reportes: true
      }
    })

    return incidencias
      // Convertir tipos Decimal de Prisma a number para operar con ellos
      .map(inc => ({
        ...inc,
        latitud: Number(inc.latitud),
        longitud: Number(inc.longitud),
        puntaje_prioridad: Number(inc.puntaje_prioridad),
        estado: String(inc.estado),
        // Calcular distancia desde el nuevo reporte hasta cada incidencia existente
        distancia_km: HaversineService.calculateDistance(
          latitud, longitud, Number(inc.latitud), Number(inc.longitud)
        )
      }))
      // Filtrar solo las que están dentro del radio de agrupación
      .filter(inc => inc.distancia_km <= radioKm)
      // Ordenar por distancia ascendente — la más cercana será la candidata a duplicado
      .sort((a, b) => a.distancia_km - b.distancia_km)
  }

  /**
   * Obtiene el radio de agrupación configurado para una categoría específica.
   * Cada categoría tiene su propio radio en la BD (en metros), que se convierte a km.
   * Ejemplo: Veredas = 30m → 0.030 km
   *
   * @param categoriaId - ID de la categoría
   * @returns Radio de agrupación en kilómetros
   */
  static async getRadioAgrupacion(categoriaId: number): Promise<number> {
    const categoria = await prisma.categoria.findUnique({
      where: { id: categoriaId },
      select: { radio_agrupacion: true } // campo en metros en la BD
    })
    if (!categoria) throw new Error(`Categoría ${categoriaId} no encontrada`)

    // Convertir metros a kilómetros dividiendo por 1000
    return categoria.radio_agrupacion / 1000
  }
}