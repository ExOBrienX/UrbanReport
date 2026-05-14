import { prisma } from '../prisma'
import { uploadPhoto } from '../uploadPhoto'

export class ReporteService {

  static async crear(
    foto: File,
    descripcion: string,
    latitud: number,
    longitud: number,
    categoriaId: number
  ) {
    // Subir foto a Cloudflare R2
    const fotoUrl = await uploadPhoto(foto)

    // Guardar reporte en MySQL con estado inicial pendiente_revision
    const reporte = await prisma.reporte.create({
      data: {
        descripcion,
        foto_url: fotoUrl,
        latitud,
        longitud,
        estado: 'pendiente_revision',
        categoria_ia_id: categoriaId,
      },
    })

    return reporte
  }

  static async obtenerActivos() {
    const reportes = await prisma.reporte.findMany({
      where: {
        estado: {
          not: 'descartado'
        }
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
      }
    })

    return reportes
  }
}