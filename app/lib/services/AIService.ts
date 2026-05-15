import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export interface ResultadoIA {
  categoria: string | null
  confianza: number
  resumen_tecnico: string
  requiere_revision: boolean
  motivo?: string
}

export class AIService {
  static async clasificarReporte(
    imagenBase64: string,
    descripcion: string
  ): Promise<ResultadoIA> {
    const prompt = `Eres un sistema de clasificación de incidencias urbanas municipales de la ciudad de Talca, Chile.

Analiza la imagen y la descripción proporcionada. Debes:
1. Verificar si la imagen muestra una incidencia urbana real y visible
2. Verificar si el problema es de dominio municipal (NO de empresas privadas como eléctricas, sanitarias, telecomunicaciones)
3. Evaluar si la imagen y la descripción son coherentes entre sí
4. Clasificar en UNA de estas categorías si corresponde: Pavimento, Veredas, Areas Verdes, Senaletica, Residuos, Mobiliario

Descripción del ciudadano: "${descripcion}"

Responde ÚNICAMENTE con un JSON válido con esta estructura exacta:
{
  "categoria": "nombre de la categoria o null si no aplica",
  "confianza": número entre 0 y 100,
  "resumen_tecnico": "descripción técnica breve para el técnico que atenderá el problema",
  "requiere_revision": true o false,
  "motivo": "razón si requiere revisión o fue rechazado, sino omitir"
}`

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/jpeg',
                data: imagenBase64,
              },
            },
            {
              type: 'text',
              text: prompt,
            },
          ],
        },
      ],
    })

    const textContent = response.content.find(c => c.type === 'text')
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No se recibió respuesta de texto de la IA')
    }

    const resultado = JSON.parse(textContent.text) as ResultadoIA
    return resultado
  }
}