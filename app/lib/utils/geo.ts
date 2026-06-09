/**
 * geo.ts — Utilidad de geocodificacion inversa para el mapa ciudadano.
 *
 * Convierte coordenadas (lat, lon) al nombre de la calle correspondiente
 * llamando al proxy interno /api/geocode, que a su vez consulta Jawg Places.
 *
 * Se usa un proxy propio en vez de llamar a Jawg directamente desde el cliente
 * porque la API key no puede exponerse en el navegador, y Nominatim
 * (alternativa gratuita) bloquea requests desde servidores cloud.
 *
 * Retorna 'Direccion no disponible' como fallback ante cualquier fallo
 * de red o rate limit — el mapa sigue funcionando sin la direccion.
 *
 * Usado por: useCityMap.ts, BandejaRevision.tsx, GestionIncidencias.tsx,
 *            AdminMap.tsx, TareaDetalleSheet.tsx
 */

export const getCalle = async (lat: number, lon: number): Promise<string> => {
  try {
    const res  = await fetch(`/api/geocode?lat=${lat}&lon=${lon}`)
    const data = await res.json()
    return data.calle ?? 'Direccion no disponible'
  } catch {
    // Cualquier fallo de red retorna el fallback — no interrumpe el flujo
    return 'Direccion no disponible'
  }
}