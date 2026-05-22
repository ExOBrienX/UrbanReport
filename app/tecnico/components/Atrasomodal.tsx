'use client'

import { useState } from 'react'

interface AtrasoModalProps {
  onConfirmar: (motivo: string) => void
  onCancelar: () => void
  accionando: boolean
}

const MOTIVOS = [
  { value: 'materiales', label: 'Falta de materiales', icon: '📦' },
  { value: 'complejidad', label: 'Complejidad mayor a la estimada', icon: '⚠️' },
  { value: 'clima', label: 'Condiciones climáticas', icon: '🌧️' },
  { value: 'otro', label: 'Otro motivo', icon: '📝' },
]

export default function AtrasoModal({ onConfirmar, onCancelar, accionando }: AtrasoModalProps) {
  const [motivoSeleccionado, setMotivoSeleccionado] = useState('')

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
              onClick={() => setMotivoSeleccionado(m.value)}
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

        <div className="flex gap-2 pt-2">
          <button
            onClick={onCancelar}
            className="flex-1 rounded-2xl border border-slate-200 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancelar
          </button>
          <button
            onClick={() => motivoSeleccionado && onConfirmar(motivoSeleccionado)}
            disabled={!motivoSeleccionado || accionando}
            className="flex-1 rounded-2xl bg-slate-900 py-3 text-sm font-medium text-white disabled:bg-slate-400"
          >
            {accionando ? 'Guardando...' : 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  )
}