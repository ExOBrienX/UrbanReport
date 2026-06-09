'use client'

/**
 * EvidenciaModal.tsx — Modal de captura de foto de evidencia para completar tarea.
 *
 * El tecnico debe fotografiar el trabajo terminado antes de marcar la tarea
 * como completada. La foto se sube a Cloudflare R2 via POST /api/tasks/[id].
 *
 * Flujo interno:
 *   1. Boton "Tomar foto" — solicita permiso de camara trasera
 *   2. Stream de video en vivo — boton "Capturar" congela el frame
 *   3. Preview de la foto — opcion de repetir si no es satisfactoria
 *   4. Boton "Completar tarea" — envia el dataURL al padre via onConfirmar
 *
 * La camara se libera automaticamente al capturar la foto o al cerrar el modal
 * para no dejarla activa en segundo plano.
 *
 * Usado por: app/tecnico/page.tsx
 */

import { useEffect, useRef, useState } from 'react'

interface EvidenciaModalProps {
  onConfirmar: (foto: string) => void // dataURL de la foto capturada
  onCancelar: () => void
  accionando: boolean                 // true mientras se sube la foto al servidor
}

export default function EvidenciaModal({ onConfirmar, onCancelar, accionando }: EvidenciaModalProps) {
  const [fotoDataUrl, setFotoDataUrl] = useState<string | null>(null)
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null)
  const [errorCamara, setErrorCamara] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)

  // Conectar el stream al elemento video cuando esta disponible
  useEffect(() => {
    if (videoRef.current && cameraStream) {
      videoRef.current.srcObject = cameraStream
      videoRef.current.play().catch(() => {})
    }
  }, [cameraStream])

  // Liberar la camara al desmontar el componente
  useEffect(() => {
    return () => { cameraStream?.getTracks().forEach(t => t.stop()) }
  }, [cameraStream])

  /**
   * Solicita acceso a la camara trasera del dispositivo.
   * facingMode 'environment' selecciona la camara trasera en movil.
   */
  const abrirCamara = async () => {
    setErrorCamara(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } }
      })
      setCameraStream(stream)
    } catch {
      setErrorCamara('No se pudo acceder a la camara')
    }
  }

  /**
   * Captura el frame actual del video usando canvas y lo convierte a JPEG.
   * Libera la camara inmediatamente despues de capturar.
   */
  const capturarFoto = () => {
    if (!videoRef.current) return
    const video = videoRef.current
    const canvas = document.createElement('canvas')
    canvas.width  = video.videoWidth  || 640
    canvas.height = video.videoHeight || 480
    canvas.getContext('2d')?.drawImage(video, 0, 0)
    setFotoDataUrl(canvas.toDataURL('image/jpeg', 0.8)) // compresion JPEG al 80%
    cameraStream?.getTracks().forEach(t => t.stop())    // liberar camara tras captura
    setCameraStream(null)
  }

  /**
   * Cancela el modal limpiando la camara y la foto capturada.
   */
  const handleCancelar = () => {
    cameraStream?.getTracks().forEach(t => t.stop())
    setCameraStream(null)
    setFotoDataUrl(null)
    onCancelar()
  }

  return (
    // Overlay — clic fuera del sheet cancela el modal
    <div className="fixed inset-0 z-50 flex items-end bg-black/50" onClick={handleCancelar}>
      <div
        className="w-full bg-white rounded-t-3xl p-6 space-y-4"
        onClick={e => e.stopPropagation()}
      >
        {/* Indicador visual de sheet deslizable */}
        <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto" />
        <h3 className="text-base font-semibold text-slate-900">Foto de evidencia</h3>
        <p className="text-sm text-slate-500">
          Toma una foto del trabajo terminado para completar la tarea.
        </p>

        {/* Estado inicial: sin stream ni foto */}
        {!cameraStream && !fotoDataUrl && (
          <button
            onClick={abrirCamara}
            className="w-full rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 py-10 text-center text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <span className="text-3xl block mb-2">📸</span>
            Tomar foto de evidencia
          </button>
        )}

        {/* Error de acceso a camara */}
        {errorCamara && (
          <p className="text-sm text-red-600 text-center">{errorCamara}</p>
        )}

        {/* Stream activo — video en vivo con boton de captura */}
        {cameraStream && (
          <div className="space-y-3">
            <video
              ref={videoRef}
              className="w-full rounded-2xl bg-black"
              autoPlay
              playsInline
              muted
            />
            <button
              onClick={capturarFoto}
              className="w-full rounded-2xl bg-amber-500 py-3 text-sm font-semibold text-white hover:bg-amber-600"
            >
              Capturar
            </button>
          </div>
        )}

        {/* Preview de la foto capturada con opcion de repetir */}
        {fotoDataUrl && (
          <div className="space-y-3">
            <div className="relative rounded-2xl overflow-hidden">
              <img src={fotoDataUrl} alt="Evidencia" className="w-full h-52 object-cover" />
              {/* Boton para descartar y volver a tomar la foto */}
              <button
                onClick={() => setFotoDataUrl(null)}
                className="absolute top-2 right-2 rounded-full bg-black/60 px-2 py-1 text-xs text-white hover:bg-black/80"
              >
                X Repetir
              </button>
            </div>
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <button
            onClick={handleCancelar}
            className="flex-1 rounded-2xl border border-slate-200 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancelar
          </button>
          {/* Boton activo solo cuando hay foto y no hay accion en progreso */}
          <button
            onClick={() => fotoDataUrl && onConfirmar(fotoDataUrl)}
            disabled={!fotoDataUrl || accionando}
            className="flex-1 rounded-2xl bg-green-600 py-3 text-sm font-semibold text-white disabled:bg-slate-400 hover:bg-green-700"
          >
            {accionando ? 'Subiendo...' : 'Completar tarea'}
          </button>
        </div>
      </div>
    </div>
  )
}