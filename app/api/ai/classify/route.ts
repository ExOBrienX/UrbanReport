import { NextRequest, NextResponse } from 'next/server'
import { AIService } from '../../../lib/services/AIService'

// SOLO PARA TESTING — no usar desde el frontend
// Permite probar el prompt de la IA directamente desde Postman
// sin crear reportes ni subir fotos a R2
//
// Body esperado (JSON):
// {
//   "imagenBase64": "data:image/jpeg;base64,...",
//   "descripcion": "descripción del problema"
// }

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { imagenBase64, descripcion } = body

    if (!imagenBase64 || !descripcion) {
      return NextResponse.json(
        { error: 'Faltan campos: imagenBase64 y descripcion son obligatorios' },
        { status: 400 }
      )
    }

    const resultado = await AIService.clasificarReporte(imagenBase64, descripcion)
    const umbral = await AIService.getConfianzaUmbral()

    return NextResponse.json({
      resultado,
      umbral_actual: umbral,
      decision: resultado.accion
    }, { status: 200 })

  } catch (error) {
    console.error('❌ Error en classify test:', error)
    return NextResponse.json({ error: 'Error al clasificar' }, { status: 500 })
  }
}