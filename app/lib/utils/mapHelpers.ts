// Devuelve el color asociado al estado del reporte
export const getColor = (estado: string): string => {
  switch (estado) {
    case 'pendiente_revision': return '#94a3b8'
    case 'pendiente': return '#ef4444'
    case 'asignado': return '#f97316'
    case 'en_curso': return '#f97316'
    case 'completado': return '#22c55e'
    default: return '#94a3b8'
  }
}

// Convierte el estado interno en etiqueta legible
export const getEstadoLabel = (estado: string): string => {
  switch (estado) {
    case 'pendiente_revision': return 'Pendiente de revisión'
    case 'pendiente': return 'Pendiente'
    case 'asignado': return 'Asignado'
    case 'en_curso': return 'En curso'
    case 'completado': return 'Completado'
    default: return estado
  }
}

// Calcula tiempo relativo desde la fecha del reporte
export const getRelativeTime = (fecha: string): string => {
  const now = new Date()
  const reportDate = new Date(fecha)
  const diffMs = now.getTime() - reportDate.getTime()
  const diffMins = Math.floor(diffMs / 1000 / 60)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMins < 1) return 'Hace unos segundos'
  if (diffMins < 60) return `Hace ${diffMins} minuto${diffMins > 1 ? 's' : ''}`
  if (diffHours < 24) return `Hace ${diffHours} hora${diffHours > 1 ? 's' : ''}`
  if (diffDays < 7) return `Hace ${diffDays} día${diffDays > 1 ? 's' : ''}`
  return reportDate.toLocaleDateString('es-CL')
}