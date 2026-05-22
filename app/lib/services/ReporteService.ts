import { prisma } from '../prisma'
import { uploadPhoto } from '../uploadPhoto'

export class ReporteService {

  static async crear(
    foto: File,
    descripcion: string,
    latitud: number,
    longitud: number,
    fotoUrl?: string // Opcional: si ya subiste la foto antes, pasa la URL directamente
  ) {
    // Subir foto a Cloudflare R2 (solo si no se pasó una URL ya procesada)
    const urlFinal = fotoUrl ?? await uploadPhoto(foto)

    // Guardar reporte en MySQL con estado inicial pendiente_revision
    // categoria_ia_id y resumen_ia se actualizan después con el resultado de la IA
    const reporte = await prisma.reporte.create({
      data: {
        descripcion,
        foto_url: urlFinal,
        latitud,
        longitud,
        estado: 'pendiente_revision',
      },
    })

    return reporte
  }

  static async obtenerActivos() {
  const reportes = await prisma.reporte.findMany({
    where: {
      estado: { not: 'descartado' }
    },
    select: {
      id: true,
      latitud: true,
      longitud: true,
      estado: true,
      descripcion: true,
      foto_url: true,
      creado_en: true,
      categoria_ia_id: true,
      resumen_ia: true,
      incidencia_id: true,
      confianza_ia: true,
      incidencia: {         // Incluir estado de la incidencia relacionada para mostrar en el mapa
        select: {
          estado: true
        }
      }
    }
  })

  return reportes
}
}