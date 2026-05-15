// Obtiene nombre de calle usando reverse geocoding de OpenStreetMap (Nominatim)
export const getCalle = async (lat: number, lon: number): Promise<string> => {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`,
      { headers: { 'Accept-Language': 'es' } }
    )
    const data = await res.json()
    const addr = data.address
    const calle = addr.road || addr.pedestrian || addr.path || ''
    const numero = addr.house_number || ''
    return calle ? `${calle}${numero ? ' ' + numero : ''}` : 'Dirección no disponible'
  } catch {
    return 'Dirección no disponible'
  }
}