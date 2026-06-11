/**
 * mapHelpers.test.ts — Pruebas unitarias de las utilidades de presentacion del mapa.
 *
 * Prueba las funciones puras que mapean estados de incidencia a colores y
 * etiquetas, y la funcion de tiempo relativo. No requieren mock de Prisma
 * porque mapHelpers no accede a la base de datos.
 */

import { describe, it, expect } from 'vitest'
import { getColor, getEstadoLabel, getRelativeTime } from './mapHelpers'

describe('getColor', () => {

  it('retorna rojo para incidencias pendientes', () => {
    expect(getColor('pendiente')).toBe('#ef4444')
  })

  it('retorna naranja para asignado y en_curso (ambos trabajo activo)', () => {
    expect(getColor('asignado')).toBe('#f97316')
    expect(getColor('en_curso')).toBe('#f97316')
  })

  it('retorna verde para incidencias completadas', () => {
    expect(getColor('completado')).toBe('#22c55e')
  })

  it('retorna gris para estados desconocidos (fallback)', () => {
    expect(getColor('estado_inexistente')).toBe('#94a3b8')
  })
})

describe('getEstadoLabel', () => {

  it('traduce los estados internos a etiquetas legibles', () => {
    expect(getEstadoLabel('pendiente_revision')).toBe('Pendiente de revision')
    expect(getEstadoLabel('en_curso')).toBe('En curso')
    expect(getEstadoLabel('completado')).toBe('Completado')
  })

  it('retorna el estado original si no tiene etiqueta definida', () => {
    expect(getEstadoLabel('estado_raro')).toBe('estado_raro')
  })
})

describe('getRelativeTime', () => {

  it('muestra "Hace unos segundos" para fechas muy recientes', () => {
    const ahora = new Date().toISOString()
    expect(getRelativeTime(ahora)).toBe('Hace unos segundos')
  })

  it('muestra los minutos para fechas de hace menos de una hora', () => {
    const hace5min = new Date(Date.now() - 5 * 60 * 1000).toISOString()
    expect(getRelativeTime(hace5min)).toBe('Hace 5 minutos')
  })

  it('usa singular para 1 minuto', () => {
    const hace1min = new Date(Date.now() - 1 * 60 * 1000).toISOString()
    expect(getRelativeTime(hace1min)).toBe('Hace 1 minuto')
  })

  it('muestra las horas para fechas de hace menos de un dia', () => {
    const hace3h = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString()
    expect(getRelativeTime(hace3h)).toBe('Hace 3 horas')
  })

  it('muestra los dias para fechas de hace menos de una semana', () => {
    const hace2dias = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
    expect(getRelativeTime(hace2dias)).toBe('Hace 2 dias')
  })
})