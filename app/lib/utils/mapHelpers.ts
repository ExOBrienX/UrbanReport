/**
 * mapHelpers.ts — Funciones utilitarias para el renderizado del mapa.
 *
 * Centraliza la logica de presentacion de estados para que el color
 * y la etiqueta sean consistentes entre CityMap (mapa ciudadano),
 * AdminMap (mapa admin) y ClusterSheet (sheet de cluster).
 *
 * Usado por: useCityMap.ts, AdminMap.tsx, ClusterSheet.tsx
 */

/**
 * Retorna el color hexadecimal asociado al estado de una incidencia.
 * Asignado y en_curso usan el mismo naranja — ambos indican trabajo activo.
 */
export const getColor = (estado: string): string => {
  switch (estado) {
    case 'pendiente_revision': return '#94a3b8' // gris — esperando revision admin
    case 'pendiente':          return '#ef4444' // rojo — sin tecnico asignado
    case 'asignado':           return '#f97316' // naranja — tecnico asignado
    case 'en_curso':           return '#f97316' // naranja — trabajo en progreso
    case 'completado':         return '#22c55e' // verde — resuelto
    default:                   return '#94a3b8'
  }
}

/**
 * Convierte el estado interno de la BD a una etiqueta legible en espanol.
 * Se usa en popups del mapa y badges del ClusterSheet.
 */
export const getEstadoLabel = (estado: string): string => {
  switch (estado) {
    case 'pendiente_revision': return 'Pendiente de revision'
    case 'pendiente':          return 'Pendiente'
    case 'asignado':           return 'Asignado'
    case 'en_curso':           return 'En curso'
    case 'completado':         return 'Completado'
    default:                   return estado
  }
}

/**
 * Calcula el tiempo transcurrido desde la fecha del reporte en lenguaje natural.
 * Muestra segundos, minutos, horas o dias segun corresponda.
 * Si el reporte tiene mas de 7 dias muestra la fecha completa.
 *
 * @param fecha - Fecha ISO del reporte (creado_en)
 */
export const getRelativeTime = (fecha: string): string => {
  const now        = new Date()
  const reportDate = new Date(fecha)
  const diffMs     = now.getTime() - reportDate.getTime()
  const diffMins   = Math.floor(diffMs / 1000 / 60)
  const diffHours  = Math.floor(diffMins / 60)
  const diffDays   = Math.floor(diffHours / 24)

  if (diffMins < 1)  return 'Hace unos segundos'
  if (diffMins < 60) return `Hace ${diffMins} minuto${diffMins > 1 ? 's' : ''}`
  if (diffHours < 24) return `Hace ${diffHours} hora${diffHours > 1 ? 's' : ''}`
  if (diffDays < 7)  return `Hace ${diffDays} dia${diffDays > 1 ? 's' : ''}`
  return reportDate.toLocaleDateString('es-CL')
}