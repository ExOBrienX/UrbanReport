/**
 * app/api/geocode/route.ts — Proxy de geocodificacion inversa via Jawg.
 *
 * Convierte coordenadas geograficas (lat, lon) al nombre de la calle
 * correspondiente usando la API de Jawg Places.
 *
 * Por que existe este proxy:
 *   - La API de Jawg requiere una API key que no puede exponerse en el cliente
 *   - Nominatim (OpenStreetMap) bloquea requests desde servidores cloud
 *   - El navegador bloquea el header User-Agent en fetch del lado cliente
 *   El proxy resuelve los tres problemas: la key queda en el servidor,
 *   Jawg acepta requests desde servidores y no requiere User-Agent especial.
 *
 * Usado por: app/lib/utils/geo.ts (getCalle)
 * Depende de: NEXT_PUBLIC_JAWG_TOKEN
 */

import { NextRequest, NextResponse } from 'next/server'

// GET /api/geocode?lat=...&lon=... — retorna el nombre de la calle
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const lat = searchParams.get('lat')
  const lon = searchParams.get('lon')

  if (!lat || !lon) {
    return NextResponse.json({ calle: 'Direccion no disponible' })
  }

  try {
    // Llamar a Jawg Places reverse geocoding desde el servidor
    // La API key se mantiene segura en el entorno del servidor (process.env)
    const res = await fetch(
      `https://api.jawg.io/places/v1/reverse?point.lat=${lat}&point.lon=${lon}&access-token=${process.env.NEXT_PUBLIC_JAWG_TOKEN}`
    )
    const data = await res.json()

    // Extraer nombre de calle y numero de la respuesta GeoJSON de Jawg
    const props = data.features?.[0]?.properties ?? {}
    const calle  = props.street || props.name || ''
    const numero = props.housenumber || ''

    // Combinar calle y numero si ambos existen, o retornar fallback
    const resultado = calle
      ? `${calle}${numero ? ' ' + numero : ''}`
      : 'Direccion no disponible'

    return NextResponse.json({ calle: resultado })
  } catch {
    // Cualquier fallo de red retorna el fallback — el mapa sigue funcionando
    return NextResponse.json({ calle: 'Direccion no disponible' })
  }
}