/**
 * PriorityService.test.ts — Pruebas unitarias del motor de calculo de prioridad.
 *
 * Prueba la funcion pura calculatePriority que determina el puntaje (0-100)
 * de una incidencia segun peligrosidad, duplicados, dias sin resolucion y zona.
 *
 * Solo se prueba calculatePriority por ser una funcion pura (entra numeros,
 * sale numero, sin acceso a BD). El metodo recalcularPrioridad no se prueba
 * aqui porque depende de Prisma (seria prueba de integracion).
 *
 * Mock de Prisma: aunque calculatePriority no usa BD, el archivo importa prisma
 * al inicio. Se mockea para que el import no intente conectarse a la base de datos.
 */

import { describe, it, expect, vi } from 'vitest'

// Mock de prisma — evita que el import del servicio intente conectar a BD
vi.mock('../prisma', () => ({ prisma: {} }))

import { PriorityService } from './PriorityService'

describe('PriorityService.calculatePriority', () => {

  it('retorna puntaje maximo cuando todas las variables estan al maximo', () => {
    // peligrosidad 100, duplicados 20+, dias 30+, zona alto transito
    const puntaje = PriorityService.calculatePriority(100, 20, 30, true)
    // Todas las variables normalizadas en 1.0, suma de pesos = 1.0 → 100
    expect(puntaje).toBe(100)
  })

  it('retorna puntaje bajo cuando todas las variables estan al minimo', () => {
    // peligrosidad 0, sin duplicados, 0 dias, zona normal (0.5)
    const puntaje = PriorityService.calculatePriority(0, 0, 0, false)
    // Solo aporta la zona normal: 0.5 * 0.15 = 0.075 → 8
    expect(puntaje).toBe(8)
  })

  it('la peligrosidad aporta el 40% del puntaje total', () => {
    // Solo peligrosidad al maximo, resto en cero, zona normal
    const puntaje = PriorityService.calculatePriority(100, 0, 0, false)
    // peligrosidad: 1.0 * 0.4 = 0.4, zona: 0.5 * 0.15 = 0.075 → 0.475 → 48
    expect(puntaje).toBe(48)
  })

  it('los duplicados se topan en 20 — mas de 20 no aumenta el puntaje', () => {
    // 20 duplicados y 50 duplicados deben dar el mismo puntaje
    const puntaje20  = PriorityService.calculatePriority(0, 20, 0, false)
    const puntaje50  = PriorityService.calculatePriority(0, 50, 0, false)
    expect(puntaje20).toBe(puntaje50)
  })

  it('los dias sin resolucion se topan en 30 — mas de 30 no aumenta el puntaje', () => {
    // 30 dias y 100 dias deben dar el mismo puntaje
    const puntaje30  = PriorityService.calculatePriority(0, 0, 30, false)
    const puntaje100 = PriorityService.calculatePriority(0, 0, 100, false)
    expect(puntaje30).toBe(puntaje100)
  })

  it('la zona de alto transito aporta mas que la zona normal', () => {
    const conAltoTransito = PriorityService.calculatePriority(50, 5, 10, true)
    const zonaNormal      = PriorityService.calculatePriority(50, 5, 10, false)
    // Alto transito normaliza a 1.0, normal a 0.5 — debe dar mas puntaje
    expect(conAltoTransito).toBeGreaterThan(zonaNormal)
  })

  it('calcula correctamente un caso realista de pavimento', () => {
    // Pavimento (peligrosidad 85), 3 reportes, 5 dias sin resolver, zona normal
    const puntaje = PriorityService.calculatePriority(85, 3, 5, false)
    // norm: peli 0.85*0.4=0.34, dup 0.15*0.25=0.0375, dias 0.166*0.2=0.033, zona 0.5*0.15=0.075
    // suma = 0.4855 → 49
    expect(puntaje).toBe(49)
  })

  it('siempre retorna un entero entre 0 y 100', () => {
    // Probar varios casos y verificar que el resultado este en rango
    const casos = [
      PriorityService.calculatePriority(50, 7, 12, true),
      PriorityService.calculatePriority(30, 1, 2, false),
      PriorityService.calculatePriority(70, 15, 25, true),
    ]
    casos.forEach(puntaje => {
      expect(Number.isInteger(puntaje)).toBe(true)
      expect(puntaje).toBeGreaterThanOrEqual(0)
      expect(puntaje).toBeLessThanOrEqual(100)
    })
  })
})