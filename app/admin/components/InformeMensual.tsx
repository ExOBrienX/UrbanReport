'use client'

/**
 * InformeMensual.tsx — Vista de generacion de informe mensual con IA (RF-24).
 *
 * Permite al administrador seleccionar un periodo con datos reales,
 * generar un informe ejecutivo usando Claude Haiku y descargarlo como PDF.
 *
 * Flujo:
 *   1. Carga los periodos disponibles desde /api/admin/informes/disponibles
 *   2. Admin selecciona ano y mes (solo periodos con incidencias reales)
 *   3. Llama a POST /api/admin/informes con mes y ano
 *   4. Renderiza el resultado como preview de documento A4
 *   5. Permite descargar como PDF via ventana de impresion del navegador
 *
 * Si no hay periodos disponibles, muestra aviso y deshabilita el boton.
 * El renderizador de Markdown convierte el texto de la IA a HTML con
 * soporte de encabezados, negrita, separadores, listas y tablas.
 *
 * Usado por: app/admin/page.tsx
 * Depende de: POST /api/admin/informes, GET /api/admin/informes/disponibles
 */

import { useEffect, useState } from 'react'

const MESES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'
]

interface Periodo { anio: number; mes: number }

/**
 * Convierte texto Markdown básico a HTML.
 * Maneja: encabezados (##, #), negrita (**), separadores (---) y listas (- ).
 */
function renderizarMarkdown(texto: string): string {
  return texto
    // Encabezados ## y #
    .replace(/^### (.+)$/gm, '<h3 style="font-size:13pt;font-weight:bold;margin:16px 0 6px;color:#1e293b">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 style="font-size:15pt;font-weight:bold;margin:20px 0 8px;color:#1e293b;border-bottom:1px solid #e2e8f0;padding-bottom:4px">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 style="font-size:18pt;font-weight:bold;margin:0 0 12px;color:#0f172a">$1</h1>')
    // Negrita **texto**
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // Separador ---
    .replace(/^---$/gm, '<hr style="border:none;border-top:1px solid #e2e8f0;margin:16px 0"/>')
    // Listas - item
    .replace(/^- (.+)$/gm, '<li style="margin:3px 0;padding-left:4px">$1</li>')
    // Saltos de línea dobles → párrafos
    .replace(/\n\n/g, '</p><p style="margin:0 0 10px;line-height:1.7">')
    // Wrap en párrafo inicial
    .replace(/^(.)/m, '<p style="margin:0 0 10px;line-height:1.7">$1')
    + '</p>'
}

export default function InformeMensual() {
  const hoy = new Date()
  const [periodos, setPeriodos] = useState<Periodo[]>([])
  const [loadingPeriodos, setLoadingPeriodos] = useState(true)

  // Año y mes seleccionados — inicializar con el último período disponible
  const [anioSel, setAnioSel] = useState<number>(hoy.getFullYear())
  const [mesSel, setMesSel] = useState<number>(hoy.getMonth() + 1)

  const [informe, setInforme] = useState<string | null>(null)
  const [periodoInforme, setPeriodoInforme] = useState<{ mes: number; anio: number } | null>(null)
  const [generando, setGenerando] = useState(false)
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)

  // Cargar períodos disponibles al montar
  useEffect(() => {
    const cargar = async () => {
      setLoadingPeriodos(true)
      try {
        const res = await fetch('/api/admin/informes/disponibles')
        const data = await res.json()
        if (data.success && data.periodos.length > 0) {
          setPeriodos(data.periodos)
          // Seleccionar el período más reciente por defecto
          const ultimo = data.periodos[data.periodos.length - 1]
          setAnioSel(ultimo.anio)
          setMesSel(ultimo.mes)
        }
      } finally {
        setLoadingPeriodos(false)
      }
    }
    cargar()
  }, [])

  // Años únicos disponibles
  const aniosDisponibles = [...new Set(periodos.map(p => p.anio))].sort((a, b) => b - a)

  // Meses disponibles para el año seleccionado
  const mesesDisponibles = periodos
    .filter(p => p.anio === anioSel)
    .map(p => p.mes)
    .sort((a, b) => a - b)

  // Si el mes seleccionado no está disponible en el nuevo año, usar el primero disponible
  const handleCambiarAnio = (nuevoAnio: number) => {
    setAnioSel(nuevoAnio)
    const mesesDelAnio = periodos.filter(p => p.anio === nuevoAnio).map(p => p.mes)
    if (!mesesDelAnio.includes(mesSel)) {
      setMesSel(mesesDelAnio[mesesDelAnio.length - 1] ?? 1)
    }
  }

  const mostrarMensaje = (tipo: 'ok' | 'error', texto: string) => {
    setMensaje({ tipo, texto })
    setTimeout(() => setMensaje(null), 5000)
  }

  const handleGenerar = async () => {
    if (periodos.length === 0) {
      mostrarMensaje('error', 'No hay datos disponibles para generar un informe')
      return
    }
    setGenerando(true)
    setInforme(null)
    setMensaje(null)
    try {
      const res = await fetch('/api/admin/informes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mes: mesSel, anio: anioSel })
      })
      const data = await res.json()
      if (!res.ok) {
        mostrarMensaje('error', data.error ?? 'Error al generar el informe')
        return
      }
      setInforme(data.informe)
      setPeriodoInforme({ mes: mesSel, anio: anioSel })
    } catch {
      mostrarMensaje('error', 'Error de conexión al generar el informe')
    } finally {
      setGenerando(false)
    }
  }

  /**
   * Abre ventana de impresión con el informe formateado como documento oficial.
   * Usa el mismo renderizado Markdown para mantener consistencia visual.
   */
  const handleDescargarPDF = () => {
    if (!informe || !periodoInforme) return
    const ventana = window.open('', '_blank')
    if (!ventana) return

    ventana.document.write(`
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <title>Informe ${MESES[periodoInforme.mes - 1]} ${periodoInforme.anio} — UrbanReport</title>
        <style>
          * { margin:0; padding:0; box-sizing:border-box; }
          body { font-family:Georgia,'Times New Roman',serif; font-size:11pt; color:#1e293b; padding:48px 64px; max-width:820px; margin:0 auto; }
          .encabezado { border-bottom:2px solid #1e293b; padding-bottom:16px; margin-bottom:28px; }
          .titulo { font-size:18pt; font-weight:bold; margin-bottom:6px; }
          .meta { font-size:10pt; color:#64748b; }
          .contenido { font-size:11pt; line-height:1.8; }
          .contenido h1 { font-size:16pt; font-weight:bold; margin:24px 0 10px; }
          .contenido h2 { font-size:13pt; font-weight:bold; margin:20px 0 8px; border-bottom:1px solid #e2e8f0; padding-bottom:4px; }
          .contenido h3 { font-size:12pt; font-weight:bold; margin:16px 0 6px; }
          .contenido p { margin:0 0 10px; }
          .contenido li { margin:3px 0 3px 20px; }
          .contenido hr { border:none; border-top:1px solid #e2e8f0; margin:16px 0; }
          .pie { margin-top:48px; padding-top:12px; border-top:1px solid #cbd5e1; font-size:9pt; color:#94a3b8; text-align:center; }
          @media print { body { padding:24px 40px; } }
        </style>
      </head>
      <body>
        <div class="encabezado">
          <div class="titulo">Informe Mensual de Incidencias Urbanas</div>
          <div class="meta">
            Período: ${MESES[periodoInforme.mes - 1]} ${periodoInforme.anio} &nbsp;|&nbsp;
            Municipalidad de Talca &nbsp;|&nbsp;
            Generado: ${new Date().toLocaleDateString('es-CL', { day:'2-digit', month:'long', year:'numeric' })}
          </div>
        </div>
        <div class="contenido">${renderizarMarkdown(informe)}</div>
        <div class="pie">
          Generado automáticamente por UrbanReport — Sistema de Gestión de Incidencias Urbanas, Municipalidad de Talca
        </div>
      </body>
      </html>
    `)
    ventana.document.close()
    setTimeout(() => { ventana.focus(); ventana.print() }, 300)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Informe mensual</h1>
        <p className="text-slate-500 text-sm mt-0.5">
          Genera un informe ejecutivo del mes usando inteligencia artificial
        </p>
      </div>

      {/* Selector de período */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <p className="text-sm font-bold text-slate-700 mb-4">Selecciona el período a analizar</p>

        {loadingPeriodos ? (
          <div className="h-12 bg-slate-100 rounded-xl animate-pulse" />
        ) : periodos.length === 0 ? (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
            <p className="text-sm text-amber-700 font-medium">
              No hay datos disponibles para generar informes. Primero deben existir incidencias registradas.
            </p>
          </div>
        ) : (
          <div className="flex items-end gap-4">
            {/* Año */}
            <div className="w-36">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">Año</label>
              <select value={anioSel} onChange={e => handleCambiarAnio(parseInt(e.target.value))}
                className="w-full border-2 border-slate-200 focus:border-slate-900 rounded-xl px-4 py-2.5 text-sm text-slate-700 outline-none transition-colors bg-white">
                {aniosDisponibles.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>

            {/* Mes — solo muestra los disponibles para el año seleccionado */}
            <div className="flex-1">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">Mes</label>
              <select value={mesSel} onChange={e => setMesSel(parseInt(e.target.value))}
                className="w-full border-2 border-slate-200 focus:border-slate-900 rounded-xl px-4 py-2.5 text-sm text-slate-700 outline-none transition-colors bg-white">
                {mesesDisponibles.map(m => (
                  <option key={m} value={m}>{MESES[m - 1]}</option>
                ))}
              </select>
            </div>

            <button onClick={handleGenerar} disabled={generando || periodos.length === 0}
              className="bg-slate-900 text-white px-6 py-2.5 rounded-xl text-sm font-bold hover:bg-slate-700 disabled:bg-slate-300 disabled:text-slate-400 transition-all flex items-center gap-2 flex-shrink-0">
              {generando
                ? <><span className="animate-spin">⟳</span> Generando...</>
                : <>Generar informe</>
              }
            </button>
          </div>
        )}

        {generando && (
          <div className="mt-4 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
            <p className="text-sm text-blue-700 font-medium">⏳ La IA está analizando los datos de {MESES[mesSel - 1]} {anioSel}...</p>
            <p className="text-xs text-blue-500 mt-1">Esto puede tomar unos segundos. Por favor espera.</p>
          </div>
        )}
      </div>

      {mensaje && (
        <div className={`rounded-xl px-4 py-3 text-sm font-medium border ${mensaje.tipo === 'ok' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
          {mensaje.texto}
        </div>
      )}

      {/* Preview del informe estilo documento */}
      {informe && periodoInforme && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          {/* Toolbar del documento */}
          <div className="flex items-center justify-between px-6 py-3 bg-slate-50 border-b border-slate-200">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-blue-100 text-blue-700">✨ IA</span>
              <span className="text-xs text-slate-500">
                {MESES[periodoInforme.mes - 1]} {periodoInforme.anio} · Generado {new Date().toLocaleDateString('es-CL')}
              </span>
            </div>
            <button onClick={handleDescargarPDF}
              className="flex items-center gap-2 bg-red-600 text-white text-xs font-bold px-4 py-2 rounded-xl hover:bg-red-700 transition-colors">
              Descargar PDF
            </button>
          </div>

          {/* Documento preview — simula hoja A4 */}
          <div className="p-8 bg-slate-100">
            <div className="bg-white shadow-md rounded-lg max-w-3xl mx-auto px-14 py-12">
              {/* Encabezado del documento */}
              <div className="border-b-2 border-slate-900 pb-4 mb-7">
                <h1 className="text-xl font-bold text-slate-900 mb-1">
                  Informe Mensual de Incidencias Urbanas
                </h1>
                <p className="text-xs text-slate-500">
                  Período: {MESES[periodoInforme.mes - 1]} {periodoInforme.anio} &nbsp;·&nbsp;
                  Municipalidad de Talca &nbsp;·&nbsp;
                  Generado: {new Date().toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' })}
                </p>
              </div>

              {/* Contenido renderizado con Markdown */}
              <div
                className="prose prose-slate prose-sm max-w-none text-slate-700 leading-relaxed"
                style={{ fontFamily: 'Georgia, serif' }}
                dangerouslySetInnerHTML={{ __html: renderizarMarkdown(informe) }}
              />

              {/* Pie del documento */}
              <div className="mt-12 pt-4 border-t border-slate-200 text-center">
                <p className="text-xs text-slate-400">
                  Generado automáticamente por UrbanReport — Sistema de Gestión de Incidencias Urbanas, Municipalidad de Talca
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}