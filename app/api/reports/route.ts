import { NextRequest, NextResponse } from 'next/server'
import { ReporteService } from '../../lib/services/ReporteService'
import { AIService } from '../../lib/services/AIService'
import { IncidenciaService } from '../../lib/services/IncidenciaService'
import { ResponseFactory } from '../../lib/factories/ResponseFactory'
import { uploadPhoto } from '../../lib/uploadPhoto'
import { prisma } from '../../lib/prisma'

// ── Constantes de validación ─────────────────────────────────────────────────
const MAX_FOTO_BYTES = 8 * 1024 * 1024          // 8MB — cubre fotos de alta gama post-compresión canvas
const MIN_DESCRIPCION_CHARS = 10
const MAX_DESCRIPCION_CHARS = 280
const TIPOS_IMAGEN_PERMITIDOS = ['image/jpeg', 'image/png', 'image/webp']

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()

    const foto = formData.get('foto') as File | null
    const descripcion = formData.get('descripcion') as string | null
    const latitud = formData.get('latitud') as string | null
    const longitud = formData.get('longitud') as string | null

    // ── Validación: campos obligatorios ──────────────────────────────────────
    if (!foto || !descripcion || !latitud || !longitud) {
      const r = ResponseFactory.validacion('Faltan campos obligatorios')
      return NextResponse.json(r.body, { status: r.status })
    }

    // ── Validación: tipo de archivo ───────────────────────────────────────────
    if (!TIPOS_IMAGEN_PERMITIDOS.includes(foto.type)) {
      const r = ResponseFactory.validacion('Solo se permiten imágenes JPG, PNG o WebP')
      return NextResponse.json(r.body, { status: r.status })
    }

    // ── Validación: coordenadas ───────────────────────────────────────────────
    const lat = parseFloat(latitud)
    const lon = parseFloat(longitud)
    if (isNaN(lat) || isNaN(lon)) {
      const r = ResponseFactory.validacion('Coordenadas inválidas')
      return NextResponse.json(r.body, { status: r.status })
    }
    // Validar que las coordenadas estén dentro de Talca
const TALCA_BOUNDS = { latMin: -35.52, latMax: -35.35, lonMin: -71.75, lonMax: -71.58 }
if (lat < TALCA_BOUNDS.latMin || lat > TALCA_BOUNDS.latMax ||
    lon < TALCA_BOUNDS.lonMin || lon > TALCA_BOUNDS.lonMax) {
  const r = ResponseFactory.validacion('Solo se aceptan reportes dentro de la ciudad de Talca')
  return NextResponse.json(r.body, { status: r.status })
}

    // ── Validación: descripción ───────────────────────────────────────────────
    const descripcionLimpia = descripcion.trim()
    if (descripcionLimpia.length < MIN_DESCRIPCION_CHARS) {
      const r = ResponseFactory.validacion(`La descripción debe tener al menos ${MIN_DESCRIPCION_CHARS} caracteres`)
      return NextResponse.json(r.body, { status: r.status })
    }
    if (descripcionLimpia.length > MAX_DESCRIPCION_CHARS) {
      const r = ResponseFactory.validacion(`La descripción no puede superar ${MAX_DESCRIPCION_CHARS} caracteres`)
      return NextResponse.json(r.body, { status: r.status })
    }

    // ── Leer buffer una sola vez ──────────────────────────────────────────────
    const arrayBuffer = await foto.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // ── Validación: tamaño de foto ────────────────────────────────────────────
    // El canvas del frontend ya comprime a JPEG 0.8, pero validamos igual
    // Una foto de iPhone 14 comprimida ronda 1-3MB, 8MB es margen seguro
    if (buffer.length > MAX_FOTO_BYTES) {
      const r = ResponseFactory.validacion('La foto no puede superar 8MB')
      return NextResponse.json(r.body, { status: r.status })
    }

    const imageBase64 = `data:${foto.type};base64,${buffer.toString('base64')}`
    console.log('✅ Foto leída, tamaño:', (buffer.length / 1024).toFixed(1), 'KB')

    // ── Subir foto a R2 antes de crear el reporte ─────────────────────────────
    let fotoUrl: string
    try {
      const fotoParaSubir = new File([buffer], foto.name || 'foto.jpg', { type: foto.type })
      fotoUrl = await uploadPhoto(fotoParaSubir)
      console.log('✅ Foto subida a R2:', fotoUrl)
    } catch (uploadError) {
      console.error('❌ Error subiendo foto a R2:', uploadError)
      const r = ResponseFactory.error('Error al subir la fotografía')
      return NextResponse.json(r.body, { status: r.status })
    }

    // ── Crear reporte inicial ─────────────────────────────────────────────────
    const reporte = await ReporteService.crear(foto, descripcionLimpia, lat, lon, fotoUrl)
    console.log('✅ Reporte creado:', reporte.id)

    // ── Leer umbral configurable desde BD ─────────────────────────────────────
    const umbral = await AIService.getConfianzaUmbral()

    // ── Clasificar con IA ─────────────────────────────────────────────────────
    let resultadoIA
    try {
      console.log('⏳ Llamando a IA...')
      resultadoIA = await AIService.clasificarReporte(imageBase64, descripcionLimpia)
      console.log('✅ Resultado IA:', JSON.stringify(resultadoIA))
    } catch (error) {
      console.error('❌ Error en IA:', error)
      // Fallo técnico de la IA → reporte queda en pendiente_revision para el admin
      const r = ResponseFactory.fallo_ia()
      return NextResponse.json(r.body, { status: r.status })
    }

    const { accion } = resultadoIA
    console.log('ℹ️ Acción IA:', accion, '| Confianza:', resultadoIA.confianza, '| Umbral:', umbral)

    // ── Buscar categoría en BD (solo si la IA aprobó) ─────────────────────────
    const categoria = (accion === 'aprobar' && resultadoIA.categoria)
      ? await prisma.categoria.findFirst({
          where: { nombre: resultadoIA.categoria, activo: true }
        })
      : null
    console.log('ℹ️ Categoría en BD:', categoria?.nombre ?? 'ninguna')

    // ── Determinar estado final del reporte ───────────────────────────────────
    const estadoReporte =
      accion === 'rechazar' ? 'descartado' :
      accion === 'revision' ? 'pendiente_revision' :
      (categoria ? 'pendiente' : 'pendiente_revision')

    await prisma.reporte.update({
      where: { id: reporte.id },
      data: {
        confianza_ia: resultadoIA.confianza,
        resumen_ia: resultadoIA.resumen_tecnico || null,
        categoria_ia_id: categoria?.id ?? null,
        estado: estadoReporte
      }
    })
    console.log('✅ Reporte actualizado, estado:', estadoReporte)

    // ── Reporte rechazado → informar al ciudadano ─────────────────────────────
    if (accion === 'rechazar') {
      console.log('🚫 Reporte rechazado:', resultadoIA.motivo)
      const r = ResponseFactory.reporteRechazado(
        resultadoIA.motivo ?? 'El reporte no cumple los requisitos del sistema municipal.'
      )
      return NextResponse.json(r.body, { status: r.status })
    }

    // ── Reporte a revisión manual ─────────────────────────────────────────────
    if (accion === 'revision' || !categoria) {
      console.log('⚠️ Reporte a revisión manual:', resultadoIA.motivo ?? 'confianza baja')
      const r = ResponseFactory.reporteEnRevision()
      return NextResponse.json(r.body, { status: r.status })
    }

    // ── Reporte aprobado → crear o agrupar incidencia ─────────────────────────
    console.log('⏳ Creando/actualizando incidencia...')
    const incidenciaResult = await IncidenciaService.crearOActualizar(
      categoria.id, lat, lon, reporte.id
    )
    console.log(
      '✅ Incidencia:', incidenciaResult.incidencia.id,
      '| Duplicado:', incidenciaResult.esDuplicado,
      '| Prioridad:', incidenciaResult.prioridad
    )

    const r = ResponseFactory.reporteAprobado({
      id: incidenciaResult.incidencia.id,
      esDuplicado: incidenciaResult.esDuplicado,
      estado: incidenciaResult.incidencia.estado,
      prioridad: incidenciaResult.prioridad
    })
    return NextResponse.json(r.body, { status: r.status })

  } catch (error) {
    console.error('❌ Error al crear reporte:', error)
    const r = ResponseFactory.error('Error interno del servidor')
    return NextResponse.json(r.body, { status: r.status })
  }
}

export async function GET() {
  try {
    const reportes = await ReporteService.obtenerActivos()
    const r = ResponseFactory.reporteListado(reportes)
    return NextResponse.json(r.body, { status: r.status })
  } catch (error) {
    console.error('Error al obtener reportes:', error)
    const r = ResponseFactory.error('Error interno del servidor')
    return NextResponse.json(r.body, { status: r.status })
  }
}