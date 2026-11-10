'use client'

/**
 * DemoNotice.tsx — Aviso de modo demostracion.
 *
 * Informa al visitante que el sitio es la demo de un proyecto academico
 * finalizado: los datos del mapa son de ejemplo y las acciones que escriben
 * en la BD estan desactivadas.
 *
 * Comportamiento:
 *   - Primera visita de la sesion: se abre como modal centrado.
 *   - Despues de cerrarlo: queda una etiqueta fija abajo a la izquierda
 *     que permite volver a abrirlo.
 *
 * Se usa sessionStorage (y no localStorage) para que el aviso reaparezca
 * en cada visita nueva, pero no en cada navegacion dentro de la misma sesion.
 *
 * Usado por: app/layout.tsx (solo cuando DEMO_MODE esta activo)
 */

import { useEffect, useState } from 'react'
import { REPO_URL } from '../../lib/demo'

const STORAGE_KEY = 'urbanreport-demo-visto'

export default function DemoNotice() {
  const [abierto, setAbierto] = useState(false)

  useEffect(() => {
    // sessionStorage puede fallar en modo privado — en ese caso se muestra siempre
    try {
      if (!sessionStorage.getItem(STORAGE_KEY)) setAbierto(true)
    } catch {
      setAbierto(true)
    }
  }, [])

  const cerrar = () => {
    try {
      sessionStorage.setItem(STORAGE_KEY, '1')
    } catch {
      // sin almacenamiento disponible — el aviso volvera a salir al recargar
    }
    setAbierto(false)
  }

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="fixed bottom-4 left-4 z-[9000] flex items-center gap-2 rounded-full border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-900 shadow-md transition hover:bg-amber-100"
        title="Ver información sobre esta demo"
      >
        <span className="h-2 w-2 rounded-full bg-amber-500" />
        Demo
      </button>
    )
  }

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="demo-titulo"
    >
      <div className="w-full max-w-md rounded-3xl bg-white p-7 shadow-xl">
        <span className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900">
          <span className="h-2 w-2 rounded-full bg-amber-500" />
          Modo demostración
        </span>

        <h2 id="demo-titulo" className="mt-4 text-xl font-semibold text-slate-900">
          Estás viendo una demo
        </h2>

        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          UrbanReport fue desarrollado como proyecto de título de Ingeniería en
          Informática. El proyecto ya terminó y su base de datos no está en línea.
        </p>

        <ul className="mt-4 space-y-2 text-sm text-slate-600">
          <li className="flex gap-2">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" />
            Las incidencias del mapa son datos de ejemplo.
          </li>
          <li className="flex gap-2">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" />
            El envío de reportes y el acceso de funcionarios están desactivados.
          </li>
        </ul>

        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={cerrar}
            className="flex-1 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-700"
          >
            Ver el mapa
          </button>
          <a
            href={REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 rounded-2xl border border-slate-200 px-4 py-3 text-center text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Código en GitHub
          </a>
        </div>
      </div>
    </div>
  )
}
