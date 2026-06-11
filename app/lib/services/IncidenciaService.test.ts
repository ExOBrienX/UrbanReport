/**
 * IncidenciaService.test.ts — Pruebas con mock de Prisma (sin BD real).
 *
 * Prueba la logica de negocio de crearOActualizar() — el metodo central del sistema
 * que decide si un reporte es duplicado de una incidencia existente o una nueva.
 *
 * Tecnica: mock de dependencias con vi.hoisted() + vi.mock()
 *   - prisma         — simula queries a MySQL con datos controlados
 *   - HaversineService — controla si hay o no incidencias cercanas
 *   - PriorityService  — evita que recalcularPrioridad llame a BD
 *
 * vi.hoisted() es necesario porque Vitest eleva (hoistea) los vi.mock() al inicio
 * del archivo antes que cualquier declaracion. Sin vi.hoisted(), las variables
 * de mock no estarian inicializadas cuando vi.mock() las necesita.
 *
 * Casos probados — los 4 caminos posibles del flujo principal:
 *   1. Reporte duplicado  — agrupa a incidencia existente cercana
 *   2. Reporte nuevo      — crea incidencia y tarea en cola compartida
 *   3. Sin tecnicos       — crea incidencia pero la deja en 'pendiente'
 *   4. Tarea ya activa    — no crea tarea duplicada para la incidencia
 *   5. Recalculo prioridad — se llama en ambos casos (duplicado y nuevo)
 *
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * vi.hoisted garantiza que los mocks esten disponibles cuando vi.mock() se ejecuta.
 * Sin esto: ReferenceError — Cannot access variable before initialization.
 */
const mocks = vi.hoisted(() => ({
  tareaFindFirst:       vi.fn(),
  tareaCreate:          vi.fn(),
  usuarioCount:         vi.fn(),
  incidenciaUpdate:     vi.fn(),
  incidenciaCreate:     vi.fn(),
  reporteUpdate:        vi.fn(),
  getRadioAgrupacion:   vi.fn(),
  findNearbyIncidences: vi.fn(),
  recalcularPrioridad:  vi.fn(),
}))

// Reemplaza prisma con un objeto que tiene las mismas funciones pero controladas
vi.mock('../prisma', () => ({
  prisma: {
    tarea:      { findFirst: mocks.tareaFindFirst, create: mocks.tareaCreate },
    usuario:    { count: mocks.usuarioCount },
    incidencia: { update: mocks.incidenciaUpdate, create: mocks.incidenciaCreate },
    reporte:    { update: mocks.reporteUpdate },
  }
}))

vi.mock('./HaversineService', () => ({
  HaversineService: {
    getRadioAgrupacion:   mocks.getRadioAgrupacion,
    findNearbyIncidences: mocks.findNearbyIncidences,
  }
}))

vi.mock('./PriorityService', () => ({
  PriorityService: {
    recalcularPrioridad: mocks.recalcularPrioridad,
  }
}))

import { IncidenciaService } from './IncidenciaService'

// ── Datos de prueba ──────────────────────────────────────────────────────────

const CATEGORIA_ID = 1       // Pavimento
const LATITUD      = -35.4264
const LONGITUD     = -71.6554
const REPORTE_ID   = 99
const RADIO_KM     = 0.050   // 50 metros

// Incidencia que ya existe en BD cercana al nuevo reporte
const incidenciaExistente = {
  id: 10, categoria_id: CATEGORIA_ID,
  latitud: -35.4265, longitud: -71.6555,
  estado: 'asignado', puntaje_prioridad: 45,
  contador_reportes: 2, distancia_km: 0.015 // a 15 metros — dentro del radio
}

// Incidencia nueva que se crearia en BD
const incidenciaNueva = {
  id: 11, categoria_id: CATEGORIA_ID,
  latitud: LATITUD, longitud: LONGITUD,
  estado: 'asignado', contador_reportes: 1,
  puntaje_prioridad: 0, creado_en: new Date(), actualizado_en: new Date()
}

const tareaCreada = { id: 55, incidencia_id: 11, tecnico_id: null, estado: 'asignada' }

// ── Setup: valores por defecto antes de cada prueba ─────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
  mocks.getRadioAgrupacion.mockResolvedValue(RADIO_KM)
  mocks.recalcularPrioridad.mockResolvedValue(42)
  mocks.tareaFindFirst.mockResolvedValue(null)    // sin tarea activa por defecto
  mocks.usuarioCount.mockResolvedValue(2)          // hay tecnicos disponibles
  mocks.tareaCreate.mockResolvedValue(tareaCreada)
  mocks.incidenciaUpdate.mockResolvedValue({})
  mocks.reporteUpdate.mockResolvedValue({})
})

// ── Pruebas ──────────────────────────────────────────────────────────────────

describe('IncidenciaService.crearOActualizar', () => {

  it('agrupa el reporte a una incidencia cercana existente (duplicado)', async () => {
    // Haversine encuentra una incidencia a 15m — dentro del radio de 50m
    mocks.findNearbyIncidences.mockResolvedValue([incidenciaExistente])
    mocks.incidenciaUpdate.mockResolvedValue({ ...incidenciaExistente, contador_reportes: 3 })

    const resultado = await IncidenciaService.crearOActualizar(CATEGORIA_ID, LATITUD, LONGITUD, REPORTE_ID)

    // Debe detectar como duplicado
    expect(resultado.esDuplicado).toBe(true)

    // Debe incrementar el contador de reportes de la incidencia existente
    expect(mocks.incidenciaUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: incidenciaExistente.id },
        data: expect.objectContaining({ contador_reportes: { increment: 1 } })
      })
    )

    // Debe vincular el reporte a la incidencia existente
    expect(mocks.reporteUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: REPORTE_ID },
        data: { incidencia_id: incidenciaExistente.id }
      })
    )

    // No debe crear una nueva incidencia
    expect(mocks.incidenciaCreate).not.toHaveBeenCalled()
  })

  it('crea nueva incidencia y tarea en cola cuando no hay duplicados cercanos', async () => {
    // Haversine no encuentra incidencias cercanas
    mocks.findNearbyIncidences.mockResolvedValue([])
    mocks.incidenciaCreate.mockResolvedValue(incidenciaNueva)

    const resultado = await IncidenciaService.crearOActualizar(CATEGORIA_ID, LATITUD, LONGITUD, REPORTE_ID)

    expect(resultado.esDuplicado).toBe(false)

    // Debe crear incidencia con las coordenadas del reporte
    expect(mocks.incidenciaCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          categoria_id: CATEGORIA_ID,
          latitud:      LATITUD,
          longitud:     LONGITUD,
          estado:       'asignado',
        })
      })
    )

    // Debe crear tarea en la cola compartida sin tecnico especifico
    expect(mocks.tareaCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tecnico_id: null,     // null = cualquier tecnico con la especialidad puede tomarla
          estado:     'asignada',
        })
      })
    )
  })

  it('deja la incidencia en pendiente si no hay tecnicos con la especialidad', async () => {
    mocks.findNearbyIncidences.mockResolvedValue([])
    mocks.incidenciaCreate.mockResolvedValue(incidenciaNueva)
    mocks.usuarioCount.mockResolvedValue(0) // sin tecnicos con esta especialidad

    await IncidenciaService.crearOActualizar(CATEGORIA_ID, LATITUD, LONGITUD, REPORTE_ID)

    // Sin tecnicos no se crea tarea — nadie podria tomarla
    expect(mocks.tareaCreate).not.toHaveBeenCalled()

    // La incidencia debe quedar en 'pendiente' para asignacion manual del admin
    expect(mocks.incidenciaUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { estado: 'pendiente' } })
    )
  })

  it('no crea tarea duplicada si ya existe una tarea activa para la incidencia', async () => {
    mocks.findNearbyIncidences.mockResolvedValue([incidenciaExistente])
    mocks.incidenciaUpdate.mockResolvedValue({ ...incidenciaExistente, contador_reportes: 3 })
    // Simular que ya hay una tarea activa — no se debe crear otra
    mocks.tareaFindFirst.mockResolvedValue({ id: 20, estado: 'en_curso' })

    await IncidenciaService.crearOActualizar(CATEGORIA_ID, LATITUD, LONGITUD, REPORTE_ID)

    expect(mocks.tareaCreate).not.toHaveBeenCalled()
  })

  it('recalcula prioridad tanto para duplicados como para incidencias nuevas', async () => {
    // Caso duplicado — debe recalcular con el ID de la incidencia existente
    mocks.findNearbyIncidences.mockResolvedValue([incidenciaExistente])
    mocks.incidenciaUpdate.mockResolvedValue({ ...incidenciaExistente })
    await IncidenciaService.crearOActualizar(CATEGORIA_ID, LATITUD, LONGITUD, REPORTE_ID)
    expect(mocks.recalcularPrioridad).toHaveBeenCalledWith(incidenciaExistente.id)

    // Resetear mocks para la segunda parte
    vi.clearAllMocks()
    mocks.getRadioAgrupacion.mockResolvedValue(RADIO_KM)
    mocks.tareaFindFirst.mockResolvedValue(null)
    mocks.usuarioCount.mockResolvedValue(2)
    mocks.tareaCreate.mockResolvedValue(tareaCreada)
    mocks.reporteUpdate.mockResolvedValue({})
    mocks.incidenciaUpdate.mockResolvedValue({})
    mocks.recalcularPrioridad.mockResolvedValue(42)

    // Caso nueva — debe recalcular con el ID de la nueva incidencia
    mocks.findNearbyIncidences.mockResolvedValue([])
    mocks.incidenciaCreate.mockResolvedValue(incidenciaNueva)
    await IncidenciaService.crearOActualizar(CATEGORIA_ID, LATITUD, LONGITUD, REPORTE_ID)
    expect(mocks.recalcularPrioridad).toHaveBeenCalledWith(incidenciaNueva.id)
  })
})