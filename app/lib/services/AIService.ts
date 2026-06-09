/**
 * AIService.ts — Servicio de clasificación de reportes con Inteligencia Artificial
 * Usa Claude Haiku 4.5 (Anthropic) para analizar imagen + descripción del ciudadano.
 * Patrón: Service — encapsula toda la lógica de comunicación con la API de Anthropic.
 * Usado por: app/api/reports/route.ts, app/api/admin/informes/route.ts
 */

import Anthropic from '@anthropic-ai/sdk'
import { ConfiguracionService } from './Configuracionservice'
import { prisma } from '../prisma'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export interface ResultadoIA {
  accion: 'aprobar' | 'revision' | 'rechazar'
  categoria: string | null
  confianza: number
  resumen_tecnico: string
  requiere_revision: boolean
  motivo?: string
}

const CATEGORIAS_VALIDAS = [
  'Pavimento', 'Veredas', 'Señaletica', 'Areas Verdes', 'Residuos', 'Mobiliario'
]

export class AIService {

  /**
   * Lee el umbral mínimo de confianza delegando a ConfiguracionService.
   * Centraliza la lógica de configuración en un solo servicio.
   */
  static async getConfianzaUmbral(): Promise<number> {
    try {
      return await ConfiguracionService.getUmbralConfianza()
    } catch {
      console.warn('⚠️ No se pudo leer umbral desde BD, usando default: 60')
      return 60
    }
  }

  /**
   * Analiza un reporte ciudadano usando Claude Haiku 4.5.
   * Recibe la imagen en base64 y la descripción textual del ciudadano.
   * Devuelve un ResultadoIA con la decisión y datos del análisis.
   */
  static async clasificarReporte(imagenBase64: string, descripcion: string): Promise<ResultadoIA> {
    const imageData = imagenBase64.includes('base64,')
      ? imagenBase64.split('base64,')[1]
      : imagenBase64

    const mediaType = imagenBase64.startsWith('data:image/png') ? 'image/png'
      : imagenBase64.startsWith('data:image/webp') ? 'image/webp'
      : 'image/jpeg'

    const prompt = `Eres un sistema de clasificación de incidencias urbanas municipales de la ciudad de Talca, Chile.

Analiza la imagen y la descripción del ciudadano siguiendo estas reglas en orden estricto:

REGLA 1 — VALIDEZ DE LA IMAGEN:
La imagen debe mostrar claramente un problema urbano real y visible en espacio público.
RECHAZA si: imagen en negro, borrosa, interior de una casa, objeto aleatorio, ícono, captura de pantalla, o sin relación con infraestructura pública.

REGLA 2 — COHERENCIA IMAGEN-DESCRIPCIÓN:
La imagen y la descripción deben referirse al mismo problema físico.
RECHAZA si la descripción habla de un problema completamente distinto a lo que muestra la imagen.

REGLA 3 — DOMINIO MUNICIPAL:
El problema debe ser responsabilidad del municipio de Talca.
RECHAZA si: cables eléctricos (empresa distribuidora), cañerías de agua potable (sanitaria), postes de telecomunicaciones, problemas al interior de propiedades privadas.

REGLA 4 — CLASIFICACIÓN:
Solo si pasó las reglas anteriores, clasifica en UNA de estas categorías exactas:
Pavimento, Veredas, Areas Verdes, Señaletica, Residuos, Mobiliario

Descripción del ciudadano: "${descripcion}"

Decide la acción según este criterio:
- "rechazar": falla REGLA 1, 2 o 3 → confianza 0, categoria null
- "revision": imagen válida y municipal pero ambigua o poco clara → confianza entre 1 y 59
- "aprobar": imagen válida, coherente, municipal y categoría clara → confianza entre 60 y 100

IMPORTANTE sobre los campos de texto:
- "resumen_tecnico": descripción objetiva del problema para el técnico que irá al lugar. Solo completar si accion es "aprobar" o "revision". Si es "rechazar", dejar string vacío.
- "motivo": mensaje claro en lenguaje ciudadano explicando el rechazo o la revisión. Obligatorio si accion es "rechazar" o "revision". Omitir si accion es "aprobar".

Responde ÚNICAMENTE con un objeto JSON válido, sin bloques de código markdown, sin texto adicional:
{
  "accion": "aprobar" | "revision" | "rechazar",
  "categoria": "nombre exacto de la categoría o null",
  "confianza": número entre 0 y 100,
  "resumen_tecnico": "descripción técnica para el técnico o string vacío",
  "requiere_revision": true o false,
  "motivo": "mensaje para el ciudadano, omitir si accion es aprobar"
}`

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageData } },
          { type: 'text', text: prompt }
        ]
      }]
    })

    const textContent = response.content.find(c => c.type === 'text')
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No se recibió respuesta de texto de la IA')
    }

    const rawText = textContent.text.trim()
    const cleanJson = rawText
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim()

    let resultado: ResultadoIA
    try {
      resultado = JSON.parse(cleanJson) as ResultadoIA
    } catch {
      console.error('❌ Error parseando JSON de IA. Texto recibido:', rawText)
      throw new Error(`Respuesta de IA no es JSON válido: ${rawText.slice(0, 200)}`)
    }

    resultado.confianza = Math.min(100, Math.max(0, Number(resultado.confianza) || 0))

    if (resultado.categoria && !CATEGORIAS_VALIDAS.includes(resultado.categoria)) {
      console.warn(`⚠️ Categoría inválida de IA: "${resultado.categoria}"`)
      resultado.accion = 'rechazar'
      resultado.categoria = null
      resultado.confianza = 0
      resultado.requiere_revision = true
      resultado.motivo = 'La categoría detectada no corresponde a ninguna categoría municipal válida.'
    }

    if (resultado.accion === 'rechazar') {
      resultado.confianza = 0
      resultado.categoria = null
      resultado.requiere_revision = true
    }

    return resultado
  }

  /**
   * Genera un informe mensual de incidencias usando Claude Haiku.
   * Analiza los datos del mes y produce un resumen ejecutivo para el admin (RF-24).
   * El informe incluye estadísticas por categoría, tiempo promedio de resolución
   * y recomendaciones basadas en los patrones detectados.
   *
   * @param mes  - Mes del informe (1-12)
   * @param anio - Año del informe
   */
  static async generarInformeMensual(mes: number, anio: number): Promise<string> {
    // Calcular rango de fechas del mes solicitado
    const inicio = new Date(anio, mes - 1, 1)
    const fin = new Date(anio, mes, 0, 23, 59, 59)

    // Obtener incidencias del mes con sus tareas y categorías
    const incidencias = await prisma.incidencia.findMany({
      where: {
        creado_en: { gte: inicio, lte: fin }
      },
      include: {
        categoria: true,
        tareas: {
          select: {
            estado: true,
            creado_en: true,
            completada_en: true,
            motivo_atraso: true
          }
        }
      }
    })

    // Calcular estadísticas por categoría
    const estadisticasPorCategoria: Record<string, {
      total: number
      completadas: number
      atrasadas: number
      tiempoPromedioHoras: number
    }> = {}

    for (const inc of incidencias) {
      const cat = inc.categoria.nombre
      if (!estadisticasPorCategoria[cat]) {
        estadisticasPorCategoria[cat] = { total: 0, completadas: 0, atrasadas: 0, tiempoPromedioHoras: 0 }
      }
      estadisticasPorCategoria[cat].total++

      const tareaCompletada = inc.tareas.find(t => t.estado === 'completada')
      if (tareaCompletada?.completada_en) {
        estadisticasPorCategoria[cat].completadas++
        const horas = (tareaCompletada.completada_en.getTime() - inc.creado_en.getTime()) / (1000 * 60 * 60)
        estadisticasPorCategoria[cat].tiempoPromedioHoras =
          (estadisticasPorCategoria[cat].tiempoPromedioHoras + horas) / estadisticasPorCategoria[cat].completadas
      }

      if (inc.tareas.some(t => t.estado === 'atrasada' || t.motivo_atraso)) {
        estadisticasPorCategoria[cat].atrasadas++
      }
    }

    // Construir el contexto de datos para el prompt
    const datosResumen = {
      periodo: `${mes}/${anio}`,
      totalIncidencias: incidencias.length,
      completadas: incidencias.filter(i => i.estado === 'completado').length,
      pendientes: incidencias.filter(i => i.estado === 'pendiente').length,
      enCurso: incidencias.filter(i => i.estado === 'en_curso').length,
      estadisticasPorCategoria
    }

    // Prompt para generar el informe ejecutivo
    const prompt = `Eres un asistente municipal experto en análisis de gestión urbana para la Municipalidad de Talca, Chile.

Con base en los siguientes datos de incidencias urbanas del período ${datosResumen.periodo}, genera un informe ejecutivo breve y profesional en español:

DATOS DEL PERÍODO:
- Total de incidencias reportadas: ${datosResumen.totalIncidencias}
- Incidencias completadas: ${datosResumen.completadas}
- Incidencias en curso: ${datosResumen.enCurso}
- Incidencias pendientes: ${datosResumen.pendientes}

ESTADÍSTICAS POR CATEGORÍA:
${JSON.stringify(datosResumen.estadisticasPorCategoria, null, 2)}

El informe debe incluir:
1. Resumen ejecutivo del período (2-3 oraciones)
2. Categorías con mayor demanda y tiempo de resolución
3. Alertas o áreas de mejora detectadas
4. Recomendaciones concretas para el siguiente período

Redacta en tono formal, conciso y orientado a la toma de decisiones. Máximo 400 palabras.`

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }]
    })

    const textContent = response.content.find(c => c.type === 'text')
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No se recibió respuesta de la IA para el informe')
    }

    console.log(`✅ Informe mensual generado para ${mes}/${anio}`)
    return textContent.text
  }
}