/**
 * HaversineService.test.ts — Pruebas unitarias del calculo de distancias geograficas.
 *
 * Prueba la funcion pura calculateDistance que usa la formula de Haversine
 * para medir la distancia entre dos coordenadas considerando la curvatura terrestre.
 *
 * Esta funcion es la base de la deduplicacion de reportes: dos reportes a menos
 * de 50 metros de la misma categoria se agrupan en una sola incidencia.
 *
 * Los metodos findNearbyIncidences y getRadioAgrupacion no se prueban aqui
 * porque dependen de Prisma (serian pruebas de integracion).
 *
 * Mock de Prisma: el archivo importa prisma al inicio, se mockea para que
 * el import no intente conectar a la base de datos.
 */

import { describe, it, expect, vi } from 'vitest'

vi.mock('../prisma', () => ({ prisma: {} }))

import { HaversineService } from './HaversineService'

describe('HaversineService.calculateDistance', () => {

  it('retorna 0 cuando los dos puntos son identicos', () => {
    const distancia = HaversineService.calculateDistance(-35.4264, -71.6554, -35.4264, -71.6554)
    expect(distancia).toBe(0)
  })

  it('calcula correctamente 1 grado de latitud (~111 km)', () => {
    // Un grado de latitud equivale a aproximadamente 111 km en cualquier punto
    const distancia = HaversineService.calculateDistance(0, 0, 1, 0)
    expect(distancia).toBeCloseTo(111.19, 1)
  })

  it('la distancia es simetrica: A a B es igual que B a A', () => {
    const ab = HaversineService.calculateDistance(-35.4264, -71.6554, -35.4300, -71.6600)
    const ba = HaversineService.calculateDistance(-35.4300, -71.6600, -35.4264, -71.6554)
    expect(ab).toBe(ba)
  })

  it('detecta dos puntos dentro del radio de 50 metros', () => {
    // Dos puntos a ~28 metros — deben estar dentro del radio de agrupacion (50m)
    const distanciaKm = HaversineService.calculateDistance(-35.4264, -71.6554, -35.42665, -71.6554)
    const radioAgrupacion = 0.050 // 50 metros en km
    expect(distanciaKm).toBeLessThanOrEqual(radioAgrupacion)
  })

  it('detecta dos puntos fuera del radio de 50 metros', () => {
    // Dos puntos a ~100 metros — deben quedar fuera del radio de agrupacion
    const distanciaKm = HaversineService.calculateDistance(-35.4264, -71.6554, -35.4273, -71.6554)
    const radioAgrupacion = 0.050 // 50 metros en km
    expect(distanciaKm).toBeGreaterThan(radioAgrupacion)
  })

  it('calcula una distancia conocida entre dos puntos de Talca', () => {
    // Distancia verificada entre dos coordenadas cercanas en Talca
    const distancia = HaversineService.calculateDistance(-35.4264, -71.6554, -35.4270, -71.6560)
    expect(distancia).toBeCloseTo(0.0861, 2)
  })

  it('siempre retorna un valor positivo o cero', () => {
    const casos = [
      HaversineService.calculateDistance(-35.42, -71.65, -35.43, -71.66),
      HaversineService.calculateDistance(10, 20, -10, -20),
      HaversineService.calculateDistance(0, 0, 0, 0),
    ]
    casos.forEach(d => expect(d).toBeGreaterThanOrEqual(0))
  })
})