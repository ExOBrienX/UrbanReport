'use client'

/**
 * Configuracion.tsx — Vista de configuracion del sistema (RF-25).
 *
 * Permite al administrador ajustar parametros del sistema sin modificar codigo.
 * Actualmente gestiona el umbral de confianza de la IA para la clasificacion
 * automatica de reportes ciudadanos.
 *
 * Umbral de confianza:
 *   - Si la IA supera este porcentaje, el reporte se aprueba automaticamente.
 *   - Si no lo supera, va a la Bandeja de Revision para aprobacion manual.
 *   - Valor recomendado: 60-80%.
 *
 * El boton "Guardar" solo se activa cuando el valor fue modificado respecto
 * al valor actual en BD — evita llamadas innecesarias a la API.
 * Los cambios se aplican de inmediato sin reiniciar el servidor.
 *
 * Usado por: app/admin/page.tsx
 * Depende de: GET /api/admin/config, PUT /api/admin/config
 */

import { useEffect, useState } from 'react'

// Descripción legible de cada clave de configuración
const CONFIG_LABELS: Record<string, { label: string; descripcion: string; tipo: 'numero' | 'texto'; min?: number; max?: number }> = {
  umbral_confianza_ia: {
    label: 'Umbral de confianza IA (%)',
    descripcion: 'Porcentaje mínimo de confianza para que la IA apruebe automáticamente un reporte. Los reportes con confianza menor irán a la Bandeja de Revisión.',
    tipo: 'numero',
    min: 0,
    max: 100
  }
}

interface Configuracion {
  clave: string
  valor: string
  descripcion?: string
}

export default function Configuracion() {
  const [configuraciones, setConfiguraciones] = useState<Configuracion[]>([])
  const [loading, setLoading] = useState(true)
  // Valores editados localmente antes de guardar
  const [valoresEditados, setValoresEditados] = useState<Record<string, string>>({})
  const [guardando, setGuardando] = useState<string | null>(null) // clave que se está guardando
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)

  /**
   * Carga todas las configuraciones del sistema desde el endpoint.
   */
  const cargar = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/config')
      const data = await res.json()
      if (data.success) {
        setConfiguraciones(data.configuraciones)
        // Inicializar valores editados con los valores actuales de BD
        const iniciales: Record<string, string> = {}
        data.configuraciones.forEach((c: Configuracion) => {
          iniciales[c.clave] = c.valor
        })
        setValoresEditados(iniciales)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { cargar() }, [])

  const mostrarMensaje = (tipo: 'ok' | 'error', texto: string) => {
    setMensaje({ tipo, texto })
    setTimeout(() => setMensaje(null), 4000)
  }

  /**
   * Guarda el nuevo valor de una configuración específica.
   * Valida rango numérico antes de enviar al backend.
   *
   * @param clave - Clave de la configuración a guardar
   */
  const handleGuardar = async (clave: string) => {
    const valor = valoresEditados[clave]
    const meta = CONFIG_LABELS[clave]

    // Validar rango si es numérico
    if (meta?.tipo === 'numero') {
      const num = parseInt(valor)
      if (isNaN(num)) {
        mostrarMensaje('error', 'El valor debe ser un número')
        return
      }
      if (meta.min !== undefined && num < meta.min) {
        mostrarMensaje('error', `El valor mínimo es ${meta.min}`)
        return
      }
      if (meta.max !== undefined && num > meta.max) {
        mostrarMensaje('error', `El valor máximo es ${meta.max}`)
        return
      }
    }

    setGuardando(clave)
    try {
      const res = await fetch('/api/admin/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clave, valor })
      })
      const data = await res.json()
      if (!res.ok) {
        mostrarMensaje('error', data.error ?? 'Error al guardar')
        return
      }
      mostrarMensaje('ok', 'Configuración guardada correctamente')
      cargar() // Recargar para confirmar el valor guardado
    } finally {
      setGuardando(null)
    }
  }

  // Verificar si el valor fue modificado respecto al valor actual en BD
  const fueModificado = (clave: string) => {
    const actual = configuraciones.find(c => c.clave === clave)?.valor
    return actual !== valoresEditados[clave]
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Configuración del sistema</h1>
        <p className="text-slate-500 text-sm mt-0.5">
          Ajusta los parámetros del sistema sin necesidad de modificar el código
        </p>
      </div>

      {mensaje && (
        <div className={`rounded-xl px-4 py-3 text-sm font-medium border ${
          mensaje.tipo === 'ok'
            ? 'bg-green-50 text-green-700 border-green-200'
            : 'bg-red-50 text-red-700 border-red-200'
        }`}>
          {mensaje.texto}
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2].map(i => <div key={i} className="h-32 bg-slate-100 rounded-2xl animate-pulse" />)}
        </div>
      ) : (
        <div className="space-y-4">
          {configuraciones.map(config => {
            const meta = CONFIG_LABELS[config.clave]
            const valorActual = valoresEditados[config.clave] ?? config.valor
            const modificado = fueModificado(config.clave)

            return (
              <div key={config.clave} className="bg-white rounded-2xl border border-slate-200 p-6">
                <div className="flex items-start justify-between gap-6">
                  <div className="flex-1">
                    {/* Nombre y descripción de la configuración */}
                    <p className="text-sm font-bold text-slate-900 mb-1">
                      {meta?.label ?? config.clave}
                    </p>
                    <p className="text-xs text-slate-500 leading-relaxed mb-4">
                      {meta?.descripcion ?? 'Sin descripción'}
                    </p>

                    {/* Input de valor */}
                    <div className="flex items-center gap-3">
                      {meta?.tipo === 'numero' ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min={meta.min}
                            max={meta.max}
                            value={valorActual}
                            onChange={e => setValoresEditados(prev => ({ ...prev, [config.clave]: e.target.value }))}
                            className="w-24 border-2 border-slate-200 focus:border-slate-900 rounded-xl px-3 py-2 text-sm text-slate-700 outline-none transition-colors text-center font-bold"
                          />
                          <span className="text-sm text-slate-400">%</span>
                          {/* Barra visual del umbral */}
                          <div className="flex-1 max-w-48">
                            <input
                              type="range"
                              min={meta.min ?? 0}
                              max={meta.max ?? 100}
                              value={valorActual}
                              onChange={e => setValoresEditados(prev => ({ ...prev, [config.clave]: e.target.value }))}
                              className="w-full accent-slate-900"
                            />
                            <div className="flex justify-between text-xs text-slate-400 mt-0.5">
                              <span>{meta.min ?? 0}%</span>
                              <span>{meta.max ?? 100}%</span>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <input
                          type="text"
                          value={valorActual}
                          onChange={e => setValoresEditados(prev => ({ ...prev, [config.clave]: e.target.value }))}
                          className="w-48 border-2 border-slate-200 focus:border-slate-900 rounded-xl px-3 py-2 text-sm text-slate-700 outline-none transition-colors"
                        />
                      )}
                    </div>

                    {/* Explicación del impacto del valor actual */}
                    {config.clave === 'umbral_confianza_ia' && (
                      <div className="mt-3 flex items-start gap-2">
                        <div className={`text-xs px-3 py-1.5 rounded-xl font-medium ${
                          parseInt(valorActual) >= 80
                            ? 'bg-green-50 text-green-700'
                            : parseInt(valorActual) >= 60
                              ? 'bg-amber-50 text-amber-700'
                              : 'bg-red-50 text-red-700'
                        }`}>
                          {parseInt(valorActual) >= 80
                            ? '✓ Filtro estricto — pocos reportes a revisión manual'
                            : parseInt(valorActual) >= 60
                              ? '~ Filtro balanceado — nivel recomendado'
                              : '⚠ Filtro permisivo — más reportes a revisión manual'
                          }
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Botón guardar — solo visible si el valor fue modificado */}
                  <div className="flex flex-col items-end gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleGuardar(config.clave)}
                      disabled={!modificado || guardando === config.clave}
                      className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                        modificado && guardando !== config.clave
                          ? 'bg-slate-900 text-white hover:bg-slate-700'
                          : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                      }`}
                    >
                      {guardando === config.clave ? 'Guardando...' : 'Guardar'}
                    </button>
                    {modificado && (
                      <p className="text-xs text-amber-600 font-medium">Sin guardar</p>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Info técnica para el admin */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Información técnica</p>
        <p className="text-xs text-slate-500 leading-relaxed">
          Los cambios de configuración se aplican de inmediato sin necesidad de reiniciar el servidor.
          El umbral de confianza afecta el flujo de aprobación automática — reportes aprobados automáticamente
          no pasan por la Bandeja de Revisión.
        </p>
      </div>
    </div>
  )
}