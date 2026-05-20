import { prisma } from '../prisma'

export interface NearbyIncidence {
  id: number
  categoria_id: number
  latitud: number
  longitud: number
  estado: string
  puntaje_prioridad: number
  contador_reportes: number
  distancia_km: number
}

export class HaversineService {
  static calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371
    const dLat = (lat2 - lat1) * (Math.PI / 180)
    const dLon = (lon2 - lon1) * (Math.PI / 180)
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) *
      Math.sin(dLon/2) * Math.sin(dLon/2)
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
  }

  static async findNearbyIncidences(latitud: number, longitud: number, categoriaId: number, radioKm: number): Promise<NearbyIncidence[]> {
    const incidencias = await prisma.incidencia.findMany({
      where: { categoria_id: categoriaId, estado: { not: 'completado' } },
      select: { id: true, categoria_id: true, latitud: true, longitud: true, estado: true, puntaje_prioridad: true, contador_reportes: true }
    })

    return incidencias
      .map(inc => ({
        ...inc,
        latitud: Number(inc.latitud),
        longitud: Number(inc.longitud),
        puntaje_prioridad: Number(inc.puntaje_prioridad),
        estado: String(inc.estado),
        distancia_km: HaversineService.calculateDistance(latitud, longitud, Number(inc.latitud), Number(inc.longitud))
      }))
      .filter(inc => inc.distancia_km <= radioKm)
      .sort((a, b) => a.distancia_km - b.distancia_km)
  }

  static async getRadioAgrupacion(categoriaId: number): Promise<number> {
    const categoria = await prisma.categoria.findUnique({
      where: { id: categoriaId },
      select: { radio_agrupacion: true }
    })
    if (!categoria) throw new Error(`Categoría ${categoriaId} no encontrada`)
    return categoria.radio_agrupacion / 1000
  }
}