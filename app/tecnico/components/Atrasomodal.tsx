'use client'

/**
 * AtrasoModal.tsx — Modal para reportar el motivo de atraso de una tarea.
 *
 * Se abre desde TareaDetalleSheet cuando el tecnico necesita reportar que
 * no podra completar la tarea en el plazo estimado.
 *
 * Cuando se selecciona "Otro motivo", aparece un campo de texto para que
 * el tecnico describa el motivo. El campo es obligatorio antes de confirmar.
 * Al backend se envia siempre el valor del enum ('otro') — el texto
 * descriptivo es solo para que el tecnico pueda detallar la situacion.
 *
 * Motivos disponibles — deben coincidir con MOTIVOS_ATRASO_VALIDOS en TareaService:
 *   materiales, complejidad, clima, otro
 *
 * Usado por: app/tecnico/page.tsx
 */

import { useState } from 'react'

interface AtrasoModalProps {
  onConfirmar: (motivo: string) => void
  onCancelar: () => void
  accionando: boolean
}

const MOTIVOS = [
  { value: 'materiales',  label: 'Falta de materiales',            icon: '📦' },
  { value: 'complejidad', label: 'Complejidad mayor a la estimada', icon: '⚠️' },
  { value: 'clima',       label: 'Condiciones climaticas',          icon: '🌧️' },
  { value: 'otro',        label: 'Otro motivo',                     icon: '📝' },
]

export default function AtrasoModal({ onConfirmar, onCancelar, accionando }: AtrasoModalProps) {
  const [motivoSeleccionado, setMotivoSeleccionado] = useState('')
  // Descripcion libre — solo visible y requerida cuando el motivo es 'otro'
  const [descripcionOtro, setDescripcionOtro] = useState('')

  // El boton confirmar requiere motivo seleccionado y, si es 'otro', descripcion no vacia
  const puedeConfirmar = motivoSeleccionado !== '' &&
    (motivoSeleccionado !== 'otro' || descripcionOtro.trim().length > 0)

  const handleSeleccionar = (value: string) => {
    setMotivoSeleccionado(value)
    // Limpiar descripcion al cambiar de motivo
    if (value !== 'otro') setDescripcionOtro('')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/50" onClick={onCancelar}>
      <div
        className="w-full bg-white rounded-t-3xl p-6 space-y-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto" />
        <h3 className="text-base font-semibold text-slate-900">Reportar atraso</h3>
        <p className="text-sm text-slate-500">Selecciona el motivo del atraso</p>

        <div className="space-y-2">
          {MOTIVOS.map(m => (
            <button
              key={m.value}
              onClick={() => handleSeleccionar(m.value)}
              className={`w-full flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm text-left transition-colors ${
                motivoSeleccionado === m.value
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <span className="text-lg">{m.icon}</span>
              {m.label}
            </button>
          ))}
        </div>

        {/* Campo de descripcion — solo aparece si el motivo es 'otro' */}
        {motivoSeleccionado === 'otro' && (
          <div>
            <label className="text-xs font-semibold text-slate-500 block mb-1">
              Describe el motivo <span className="text-red-500">*</span>
            </label>
            <textarea
              value={descripcionOtro}
              onChange={e => setDescripcionOtro(e.target.value)}
              rows={3}
              placeholder="Explica brevemente el motivo del atraso..."
              className="w-full border-2 border-slate-200 focus:border-slate-900 rounded-2xl px-4 py-3 text-sm text-slate-700 outline-none resize-none transition-colors"
            />
            <p className="text-xs text-slate-400 mt-1 text-right">
              {descripcionOtro.length}/200
            </p>
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <button
            onClick={onCancelar}
            className="flex-1 rounded-2xl border border-slate-200 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancelar
          </button>
          <button
            onClick={() => puedeConfirmar && onConfirmar(motivoSeleccionado)}
            disabled={!puedeConfirmar || accionando}
            className="flex-1 rounded-2xl bg-slate-900 py-3 text-sm font-medium text-white disabled:bg-slate-400"
          >
            {accionando ? 'Guardando...' : 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  )
}