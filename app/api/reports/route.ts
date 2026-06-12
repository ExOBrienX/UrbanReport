/**
 * app/api/reports/route.ts — Creación y listado de reportes ciudadanos.
 *
 * POST /api/reports — Recibe un reporte con foto, descripcion y coordenadas.
 *   Flujo completo:
 *     1. Validar campos, tipo de imagen, coordenadas dentro de Talca y tamaño
 *     2. Subir foto a Cloudflare R2
 *     3. Crear reporte inicial en BD
 *     4. Clasificar con IA (Claude Haiku) usando imagen base64 y descripcion
 *     5. Actualizar reporte con resultado de la IA (confianza, categoria, estado)
 *     6. Si aprobado: crear o agrupar incidencia via IncidenciaService (Haversine)
 *     7. Retornar respuesta al ciudadano via ResponseFactory
 *
 * GET /api/reports — Devuelve reportes activos para el mapa ciudadano.
 *   Excluye descartados e incidencias completadas hace mas de 48h (RF-08).
 *
 * Acceso publico — no requiere autenticacion (cualquier ciudadano puede reportar).
 * Depende de: ReporteService, AIService, IncidenciaService, ResponseFactory, uploadPhoto
 */

import { NextRequest, NextResponse } from 'next/server'
import { ReporteService } from '../../lib/services/ReporteService'
import { AIService } from '../../lib/services/AIService'
import { IncidenciaService } from '../../lib/services/IncidenciaService'
import { ResponseFactory } from '../../lib/factories/ResponseFactory'
import { uploadPhoto } from '../../lib/uploadPhoto'
import { prisma } from '../../lib/prisma'

// Constantes de validacion — centralizadas para facilitar ajustes futuros
const MAX_FOTO_BYTES = 8 * 1024 * 1024   // 8MB — margen seguro para fotos comprimidas por canvas
const MIN_DESCRIPCION_CHARS = 10
const MAX_DESCRIPCION_CHARS = 280
const TIPOS_IMAGEN_PERMITIDOS = ['image/jpeg', 'image/png', 'image/webp']

// Limites geograficos del area urbana de Talca
// Los reportes fuera de estos limites son rechazados antes de llamar a la IA
const TALCA_BOUNDS = { latMin: -35.52, latMax: -35.35, lonMin: -71.75, lonMax: -71.58 }

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()

    const foto        = formData.get('foto')        as File   | null
    const descripcion = formData.get('descripcion') as string | null
    const latitud     = formData.get('latitud')     as string | null
    const longitud    = formData.get('longitud')    as string | null

    // Validacion: campos obligatorios
    if (!foto || !descripcion || !latitud || !longitud) {
      const r = ResponseFactory.validacion('Faltan campos obligatorios')
      return NextResponse.json(r.body, { status: r.status })
    }

    // Validacion: tipo de archivo
    if (!TIPOS_IMAGEN_PERMITIDOS.includes(foto.type)) {
      const r = ResponseFactory.validacion('Solo se permiten imagenes JPG, PNG o WebP')
      return NextResponse.json(r.body, { status: r.status })
    }

    // Validacion: coordenadas numericas validas
    const lat = parseFloat(latitud)
    const lon = parseFloat(longitud)
    if (isNaN(lat) || isNaN(lon)) {
      const r = ResponseFactory.validacion('Coordenadas invalidas')
      return NextResponse.json(r.body, { status: r.status })
    }

    // Validacion: coordenadas dentro del area de Talca
    if (
      lat < TALCA_BOUNDS.latMin || lat > TALCA_BOUNDS.latMax ||
      lon < TALCA_BOUNDS.lonMin || lon > TALCA_BOUNDS.lonMax
    ) {
      const r = ResponseFactory.validacion('Solo se aceptan reportes dentro de la ciudad de Talca')
      return NextResponse.json(r.body, { status: r.status })
    }

    // Validacion: longitud de descripcion
    const descripcionLimpia = descripcion.trim()
    if (descripcionLimpia.length < MIN_DESCRIPCION_CHARS) {
      const r = ResponseFactory.validacion(`La descripcion debe tener al menos ${MIN_DESCRIPCION_CHARS} caracteres`)
      return NextResponse.json(r.body, { status: r.status })
    }
    if (descripcionLimpia.length > MAX_DESCRIPCION_CHARS) {
      const r = ResponseFactory.validacion(`La descripcion no puede superar ${MAX_DESCRIPCION_CHARS} caracteres`)
      return NextResponse.json(r.body, { status: r.status })
    }

    // Leer buffer una sola vez — evita multiples lecturas del stream de la foto
    const arrayBuffer = await foto.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Validacion: tamaño de foto
    // El canvas del frontend comprime a JPEG 0.8, pero validamos igual por seguridad
    if (buffer.length > MAX_FOTO_BYTES) {
      const r = ResponseFactory.validacion('La foto no puede superar 8MB')
      return NextResponse.json(r.body, { status: r.status })
    }

    // Convertir a base64 para enviarlo a la API de Claude Haiku
    const imageBase64 = `data:${foto.type};base64,${buffer.toString('base64')}`
    console.log('Foto leida, tamanio:', (buffer.length / 1024).toFixed(1), 'KB')

    // Subir foto a Cloudflare R2 antes de crear el reporte
    // Si falla la subida, no tiene sentido continuar con la clasificacion
    let fotoUrl: string
    try {
      const fotoParaSubir = new File([buffer], foto.name || 'foto.jpg', { type: foto.type })
      fotoUrl = await uploadPhoto(fotoParaSubir)
      console.log('Foto subida a R2:', fotoUrl)
    } catch (uploadError) {
      console.error('Error subiendo foto a R2:', uploadError)
      const r = ResponseFactory.error('Error al subir la fotografia')
      return NextResponse.json(r.body, { status: r.status })
    }

    // Crear reporte inicial en BD — estado pendiente hasta que la IA lo procese
    const reporte = await ReporteService.crear(foto, descripcionLimpia, lat, lon, fotoUrl)
    console.log('Reporte creado:', reporte.id)

    // Leer umbral de confianza configurable desde BD (tabla configuracion_sistema)
    // Permite al admin ajustar cuantos reportes van a revision manual sin tocar codigo
    const umbral = await AIService.getConfianzaUmbral()

    // Clasificar reporte con Claude Haiku — analiza imagen y descripcion
    let resultadoIA
    try {
      console.log('Llamando a IA...')
      resultadoIA = await AIService.clasificarReporte(imageBase64, descripcionLimpia)
      console.log('Resultado IA:', JSON.stringify(resultadoIA))
    } catch (error) {
      console.error('Error en IA:', error)
      // Fallo tecnico de la IA — el reporte queda en pendiente_revision para revision manual
      const r = ResponseFactory.falloIA()
      return NextResponse.json(r.body, { status: r.status })
    }

    const { accion } = resultadoIA
    console.log('Accion IA:', accion, '| Confianza:', resultadoIA.confianza, '| Umbral:', umbral)

    // Buscar la categoria sugerida por la IA en BD — solo si la IA aprobó
    // Se busca por nombre porque la IA devuelve el nombre textual, no el ID
    const categoria = (accion === 'aprobar' && resultadoIA.categoria)
      ? await prisma.categoria.findFirst({
          where: { nombre: resultadoIA.categoria, activo: true }
        })
      : null
    console.log('Categoria en BD:', categoria?.nombre ?? 'ninguna')

    // Determinar estado final del reporte segun la decision de la IA
    const estadoReporte =
      accion === 'rechazar' ? 'descartado'         :
      accion === 'revision' ? 'pendiente_revision' :
      (categoria ? 'pendiente' : 'pendiente_revision') // sin categoria = a revision aunque la IA aprobó

    // Actualizar reporte con resultado completo de la IA
    await prisma.reporte.update({
      where: { id: reporte.id },
      data: {
        confianza_ia:   resultadoIA.confianza,
        resumen_ia:     resultadoIA.resumen_tecnico || null,
        categoria_ia_id: categoria?.id ?? null,
        estado:         estadoReporte
      }
    })
    console.log('Reporte actualizado, estado:', estadoReporte)

    // Reporte rechazado — informar al ciudadano con el motivo de la IA
    if (accion === 'rechazar') {
      console.log('Reporte rechazado:', resultadoIA.motivo)
      const r = ResponseFactory.reporteRechazado(
        resultadoIA.motivo ?? 'El reporte no cumple los requisitos del sistema municipal.'
      )
      return NextResponse.json(r.body, { status: r.status })
    }

    // Reporte a revision manual — confianza baja o categoria no identificada
    if (accion === 'revision' || !categoria) {
      console.log('Reporte a revision manual:', resultadoIA.motivo ?? 'confianza baja')
      const r = ResponseFactory.reporteEnRevision()
      return NextResponse.json(r.body, { status: r.status })
    }

    // Reporte aprobado — crear nueva incidencia o agrupar con una cercana (Haversine)
    console.log('Creando/actualizando incidencia...')
    const incidenciaResult = await IncidenciaService.crearOActualizar(
      categoria.id, lat, lon, reporte.id
    )
    console.log(
      'Incidencia:', incidenciaResult.incidencia.id,
      '| Duplicado:', incidenciaResult.esDuplicado,
      '| Prioridad:', incidenciaResult.prioridad
    )

    const r = ResponseFactory.reporteAprobado({
      id:          incidenciaResult.incidencia.id,
      esDuplicado: incidenciaResult.esDuplicado,
      estado:      incidenciaResult.incidencia.estado,
      prioridad:   incidenciaResult.prioridad
    })
    return NextResponse.json(r.body, { status: r.status })

  } catch (error) {
    console.error('Error al crear reporte:', error)
    const r = ResponseFactory.error('Error interno del servidor')
    return NextResponse.json(r.body, { status: r.status })
  }
}

// GET /api/reports — reportes activos para el mapa ciudadano
export async function GET() {
  try {
    // obtenerActivos filtra descartados e incidencias completadas hace mas de 48h (RF-08)
    const reportes = await ReporteService.obtenerActivos()
    const r = ResponseFactory.reporteListado(reportes)
    return NextResponse.json(r.body, { status: r.status })
  } catch (error) {
    console.error('Error al obtener reportes:', error)
    const r = ResponseFactory.error('Error interno del servidor')
    return NextResponse.json(r.body, { status: r.status })
  }
}