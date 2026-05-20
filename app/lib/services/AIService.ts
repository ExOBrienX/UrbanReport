import Anthropic from '@anthropic-ai/sdk'
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
  'Pavimento', 'Veredas', 'Areas Verdes', 'Senaletica', 'Residuos', 'Mobiliario'
]
const CONFIANZA_UMBRAL_DEFAULT = 60

export class AIService {

  // Lee el umbral desde configuracion_sistema, con fallback al valor hardcodeado
  static async getConfianzaUmbral(): Promise<number> {
    try {
      const config = await prisma.configuracionSistema.findUnique({
        where: { clave: 'umbral_confianza_ia' }
      })
      if (config) return parseInt(config.valor, 10)
    } catch {
      console.warn('⚠️ No se pudo leer umbral_confianza_ia desde BD, usando default:', CONFIANZA_UMBRAL_DEFAULT)
    }
    return CONFIANZA_UMBRAL_DEFAULT
  }

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

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
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

    // Sanidad: categoría fuera del listado válido → rechazar
    if (resultado.categoria && !CATEGORIAS_VALIDAS.includes(resultado.categoria)) {
      console.warn(`⚠️ Categoría inválida de IA: "${resultado.categoria}"`)
      resultado.accion = 'rechazar'
      resultado.categoria = null
      resultado.confianza = 0
      resultado.requiere_revision = true
      resultado.motivo = 'La categoría detectada no corresponde a ninguna categoría municipal válida.'
    }

    // Sanidad: rechazar siempre implica confianza 0 y categoria null
    if (resultado.accion === 'rechazar') {
      resultado.confianza = 0
      resultado.categoria = null
      resultado.requiere_revision = true
    }

    return resultado
  }
}