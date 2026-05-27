/**
 * AIService.ts — Servicio de clasificación de reportes con Inteligencia Artificial
 * Usa Claude Haiku 4.5 (Anthropic) para analizar imagen + descripción del ciudadano.
 * Patrón: Service — encapsula toda la lógica de comunicación con la API de Anthropic.
 * Usado por: app/api/reports/route.ts
 */

import Anthropic from '@anthropic-ai/sdk'
import { prisma } from '../prisma'

// Cliente de Anthropic — se inicializa con la API key del archivo .env
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

/**
 * Estructura del resultado que devuelve la IA al analizar un reporte.
 * Esta interfaz es importada por ResponseFactory.ts y route.ts.
 */
export interface ResultadoIA {
  accion: 'aprobar' | 'revision' | 'rechazar' // decisión principal de la IA
  categoria: string | null    // categoría municipal detectada, o null si no aplica
  confianza: number           // nivel de certeza de la IA (0-100)
  resumen_tecnico: string     // descripción técnica para el técnico que atenderá
  requiere_revision: boolean  // true si debe pasar por revisión del admin
  motivo?: string             // mensaje legible para el ciudadano (solo en rechazo/revisión)
}

// Categorías municipales válidas — deben coincidir exactamente con la tabla 'categorias' en BD
const CATEGORIAS_VALIDAS = [
  'Pavimento', 'Veredas', 'Areas Verdes', 'Senaletica', 'Residuos', 'Mobiliario'
]

// Umbral de confianza por defecto si no se puede leer desde la BD
const CONFIANZA_UMBRAL_DEFAULT = 60

export class AIService {

  /**
   * Lee el umbral mínimo de confianza desde la tabla 'configuracion_sistema' en BD.
   * Esto permite al administrador ajustarlo sin modificar el código.
   * Si falla la lectura (BD no disponible, clave no existe), usa el valor por defecto.
   */
  static async getConfianzaUmbral(): Promise<number> {
    try {
      // Busca la fila con clave 'umbral_confianza_ia' en configuracion_sistema
      const config = await prisma.configuracionSistema.findUnique({
        where: { clave: 'umbral_confianza_ia' }
      })
      // Si existe, convierte el valor string a número entero
      if (config) return parseInt(config.valor, 10)
    } catch {
      console.warn('⚠️ No se pudo leer umbral_confianza_ia desde BD, usando default:', CONFIANZA_UMBRAL_DEFAULT)
    }
    return CONFIANZA_UMBRAL_DEFAULT
  }

  /**
   * Analiza un reporte ciudadano usando Claude Haiku 4.5.
   * Recibe la imagen en base64 y la descripción textual del ciudadano.
   * Devuelve un ResultadoIA con la decisión y datos del análisis.
   *
   * @param imagenBase64 - Foto del problema en formato base64 (con o sin prefijo data:image/...)
   * @param descripcion  - Texto descriptivo del ciudadano sobre el problema
   */
  static async clasificarReporte(imagenBase64: string, descripcion: string): Promise<ResultadoIA> {

    // Extraer solo los datos base64 puros, eliminando el prefijo "data:image/jpeg;base64,"
    // que el navegador agrega al convertir una imagen a base64
    const imageData = imagenBase64.includes('base64,')
      ? imagenBase64.split('base64,')[1]
      : imagenBase64

    // Detectar el tipo de imagen desde el prefijo para enviarlo correctamente a la API
    const mediaType = imagenBase64.startsWith('data:image/png') ? 'image/png'
      : imagenBase64.startsWith('data:image/webp') ? 'image/webp'
      : 'image/jpeg' // jpeg por defecto (canvas del navegador siempre genera jpeg)

    // Prompt que instruye a Claude cómo analizar el reporte
    // Usa 4 reglas en orden estricto para garantizar coherencia en las decisiones
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
Pavimento, Veredas, Areas Verdes, Senaletica, Residuos, Mobiliario

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

    // Llamada a la API de Anthropic con la imagen y el prompt
    // El modelo recibe tanto la imagen como el texto en el mismo mensaje
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001', // modelo rápido y económico de Anthropic
      max_tokens: 500,                     // suficiente para el JSON de respuesta
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mediaType, data: imageData }
          },
          { type: 'text', text: prompt }
        ]
      }]
    })

    // Extraer el bloque de texto de la respuesta (puede haber múltiples bloques)
    const textContent = response.content.find(c => c.type === 'text')
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No se recibió respuesta de texto de la IA')
    }

    // Limpiar posibles bloques ```json ... ``` que el modelo puede agregar
    // aunque el prompt pide explícitamente no incluirlos
    const rawText = textContent.text.trim()
    const cleanJson = rawText
      .replace(/^```json\s*/i, '') // elimina ```json al inicio
      .replace(/^```\s*/i, '')     // elimina ``` al inicio
      .replace(/\s*```$/i, '')     // elimina ``` al final
      .trim()

    // Parsear el JSON — si falla, lanzar error con el texto recibido para debug
    let resultado: ResultadoIA
    try {
      resultado = JSON.parse(cleanJson) as ResultadoIA
    } catch {
      console.error('❌ Error parseando JSON de IA. Texto recibido:', rawText)
      throw new Error(`Respuesta de IA no es JSON válido: ${rawText.slice(0, 200)}`)
    }

    // Normalizar confianza al rango [0, 100] por si la IA devuelve valores fuera de rango
    resultado.confianza = Math.min(100, Math.max(0, Number(resultado.confianza) || 0))

    // Verificación de sanidad: si la categoría no está en el listado válido,
    // forzar rechazo para evitar que se creen incidencias con categorías inexistentes en BD
    if (resultado.categoria && !CATEGORIAS_VALIDAS.includes(resultado.categoria)) {
      console.warn(`⚠️ Categoría inválida de IA: "${resultado.categoria}"`)
      resultado.accion = 'rechazar'
      resultado.categoria = null
      resultado.confianza = 0
      resultado.requiere_revision = true
      resultado.motivo = 'La categoría detectada no corresponde a ninguna categoría municipal válida.'
    }

    // Verificación de sanidad: si la acción es rechazar, asegurar que
    // confianza y categoria queden en valores consistentes
    if (resultado.accion === 'rechazar') {
      resultado.confianza = 0
      resultado.categoria = null
      resultado.requiere_revision = true
    }

    return resultado
  }
}