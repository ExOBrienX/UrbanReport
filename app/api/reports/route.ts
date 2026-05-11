import { NextRequest, NextResponse } from 'next/server'
import { ReporteService } from '../../lib/services/ReporteService'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()

    const foto = formData.get('foto') as File | null
    const descripcion = formData.get('descripcion') as string | null
    const latitud = formData.get('latitud') as string | null
    const longitud = formData.get('longitud') as string | null
    const categoriaId = formData.get('categoriaId') as string | null

    if (!foto || !descripcion || !latitud || !longitud || !categoriaId) {
      return NextResponse.json(
        { error: 'Faltan campos obligatorios' },
        { status: 400 }
      )
    }

    const reporte = await ReporteService.crear(
      foto,
      descripcion,
      parseFloat(latitud),
      parseFloat(longitud),
      parseInt(categoriaId)
    )

    return NextResponse.json({ success: true, reporte }, { status: 201 })

  } catch (error) {
    console.error('Error al crear reporte:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    const reportes = await ReporteService.obtenerActivos()
    return NextResponse.json({ success: true, reportes }, { status: 200 })

  } catch (error) {
    console.error('Error al obtener reportes:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}