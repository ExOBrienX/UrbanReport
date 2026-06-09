// app/lib/utils/geo.ts
export const getCalle = async (lat: number, lon: number): Promise<string> => {
  try {
    const res = await fetch(`/api/geocode?lat=${lat}&lon=${lon}`)
    const data = await res.json()
    return data.calle ?? 'Dirección no disponible'
  } catch {
    return 'Dirección no disponible'
  }
}