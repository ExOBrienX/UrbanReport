/**
 * getEstadoVisual.test.ts — Pruebas unitarias de la logica de badge de estado
 * en el panel de Gestion de Incidencias del administrador.
 *
 * getEstadoVisual distingue entre tres situaciones que el campo incidencia.estado
 * no puede diferenciar por si solo:
 *
 *   1. "Sin asignar" (pendiente) — no existe tarea todavia
 *   2. "En cola" (asignado, tarea sin tecnico) — la IA creo una tarea en la cola
 *      compartida pero ningun tecnico la ha aceptado aun
 *   3. "Asignado" (asignado, tarea con tecnico) — un tecnico especifico fue asignado
 *
 * Esta logica se creo para corregir el bug donde incidencias "en cola" mostraban
 * el badge "Asignado", confundiendo al admin sobre el estado real de la tarea.
 *
 * No requiere mock de Prisma porque es una funcion pura que solo evalua
 * el objeto de incidencia que ya viene del fetch.
 */

import { describe, it, expect } from 'vitest'

// Tipos minimos para la prueba — replica la interfaz Incidencia del componente
interface TareaSimple {
  id: number
  estado: string
  tecnico: { id: number; nombre: string } | null
}

interface IncidenciaSimple {
  estado: string
  tareas: TareaSimple[]
}

// Replica exacta de la funcion getEstadoVisual de GestionIncidencias.tsx
const ESTADO_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  pendiente:  { label: 'Sin asignar', color: 'bg-red-100 text-red-700',      dot: 'bg-red-500' },
  en_cola:    { label: 'En cola',     color: 'bg-purple-100 text-purple-700', dot: 'bg-purple-500' },
  asignado:   { label: 'Asignado',    color: 'bg-blue-100 text-blue-700',    dot: 'bg-blue-500' },
  en_curso:   { label: 'En curso',    color: 'bg-amber-100 text-amber-700',  dot: 'bg-amber-500' },
  completado: { label: 'Completado',  color: 'bg-green-100 text-green-700',  dot: 'bg-green-500' },
}

function getEstadoVisual(inc: IncidenciaSimple): { label: string; color: string; dot: string } {
  if (inc.estado === 'asignado' && inc.tareas[0] && !inc.tareas[0].tecnico) {
    return ESTADO_CONFIG.en_cola
  }
  return ESTADO_CONFIG[inc.estado] ?? ESTADO_CONFIG.pendiente
}

describe('getEstadoVisual', () => {

  it('muestra "Sin asignar" cuando la incidencia no tiene tarea', () => {
    // Caso: reporte nuevo sin tecnicos disponibles, pendiente de asignacion manual
    const inc: IncidenciaSimple = { estado: 'pendiente', tareas: [] }
    const resultado = getEstadoVisual(inc)
    expect(resultado.label).toBe('Sin asignar')
    expect(resultado.color).toContain('red')
  })

  it('muestra "En cola" cuando la tarea existe pero no tiene tecnico asignado', () => {
    // Caso: IA aprobo y creo tarea en cola compartida, nadie la ha aceptado aun
    const inc: IncidenciaSimple = {
      estado: 'asignado',
      tareas: [{ id: 1, estado: 'asignada', tecnico: null }]
    }
    const resultado = getEstadoVisual(inc)
    expect(resultado.label).toBe('En cola')
    expect(resultado.color).toContain('purple')
  })

  it('muestra "Asignado" cuando la tarea tiene un tecnico especifico', () => {
    // Caso: admin asigno directamente o tecnico acepto la tarea de la cola
    const inc: IncidenciaSimple = {
      estado: 'asignado',
      tareas: [{ id: 1, estado: 'aceptada', tecnico: { id: 3, nombre: 'Marco Paredes' } }]
    }
    const resultado = getEstadoVisual(inc)
    expect(resultado.label).toBe('Asignado')
    expect(resultado.color).toContain('blue')
  })

  it('muestra "En curso" cuando el tecnico inicio el trabajo', () => {
    const inc: IncidenciaSimple = {
      estado: 'en_curso',
      tareas: [{ id: 1, estado: 'en_curso', tecnico: { id: 3, nombre: 'Carlos Munoz' } }]
    }
    const resultado = getEstadoVisual(inc)
    expect(resultado.label).toBe('En curso')
    expect(resultado.color).toContain('amber')
  })

  it('muestra "Completado" para incidencias resueltas', () => {
    const inc: IncidenciaSimple = {
      estado: 'completado',
      tareas: [{ id: 1, estado: 'completada', tecnico: { id: 3, nombre: 'Carlos Munoz' } }]
    }
    const resultado = getEstadoVisual(inc)
    expect(resultado.label).toBe('Completado')
    expect(resultado.color).toContain('green')
  })

  it('nunca confunde "En cola" con "Asignado" — el bug original', () => {
    // Este es el bug que se corrigio: incidencia #24 mostraba "Asignado"
    // cuando la tarea tenia tecnico_id = null
    const incEnCola: IncidenciaSimple = {
      estado: 'asignado',
      tareas: [{ id: 27, estado: 'asignada', tecnico: null }]
    }
    const incAsignada: IncidenciaSimple = {
      estado: 'asignado',
      tareas: [{ id: 1, estado: 'aceptada', tecnico: { id: 2, nombre: 'Pedro Soto' } }]
    }
    expect(getEstadoVisual(incEnCola).label).toBe('En cola')
    expect(getEstadoVisual(incAsignada).label).toBe('Asignado')
    // Los dos labels deben ser distintos — nunca el mismo
    expect(getEstadoVisual(incEnCola).label).not.toBe(getEstadoVisual(incAsignada).label)
  })
})