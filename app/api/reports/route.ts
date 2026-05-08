import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '../../lib/prisma'
import { uploadPhoto } from '../../lib/uploadPhoto'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()

    const foto = formData.get('foto') as File | null
    const descripcion = formData.get('descripcion') as string | null
    const latitud = formData.get('latitud') as string | null
    const longitud = formData.get('longitud') as string | null
    const categoriaId = formData.get('categoriaId') as string | null

    // Validar campos obligatorios
    if (!foto || !descripcion || !latitud || !longitud || !categoriaId) {
      return NextResponse.json(
        { error: 'Faltan campos obligatorios' },
        { status: 400 }
      )
    }

    // Subir foto a Cloudflare R2
    const fotoUrl = await uploadPhoto(foto)

    // Guardar reporte en MySQL con estado inicial pendiente_revision
    const reporte = await prisma.reporte.create({
      data: {
        descripcion,
        foto_url: fotoUrl,
        latitud: parseFloat(latitud),
        longitud: parseFloat(longitud),
        estado: 'pendiente_revision',
        categoria_ia_id: parseInt(categoriaId),
      },
    })

    return NextResponse.json({ success: true, reporte }, { status: 201 })

  } catch (error) {
    console.error('Error al crear reporte:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}