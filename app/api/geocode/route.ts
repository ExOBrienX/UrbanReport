import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const lat = searchParams.get('lat')
  const lon = searchParams.get('lon')

  if (!lat || !lon) {
    return NextResponse.json({ calle: 'Dirección no disponible' })
  }

  try {
    const res = await fetch(
      `https://api.jawg.io/places/v1/reverse?point.lat=${lat}&point.lon=${lon}&access-token=${process.env.NEXT_PUBLIC_JAWG_TOKEN}`
    )
    const data = await res.json()
    const props = data.features?.[0]?.properties ?? {}
    const calle = props.street || props.name || ''
    const numero = props.housenumber || ''
    const resultado = calle ? `${calle}${numero ? ' ' + numero : ''}` : 'Dirección no disponible'
    return NextResponse.json({ calle: resultado })
  } catch {
    return NextResponse.json({ calle: 'Dirección no disponible' })
  }
}