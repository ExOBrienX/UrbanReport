'use client'

import { useEffect, useRef, useState } from 'react'

interface EvidenciaModalProps {
  onConfirmar: (foto: string) => void
  onCancelar: () => void
  accionando: boolean
}

export default function EvidenciaModal({ onConfirmar, onCancelar, accionando }: EvidenciaModalProps) {
  const [fotoDataUrl, setFotoDataUrl] = useState<string | null>(null)
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null)
  const [errorCamara, setErrorCamara] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)

  useEffect(() => {
    if (videoRef.current && cameraStream) {
      videoRef.current.srcObject = cameraStream
      videoRef.current.play().catch(() => {})
    }
  }, [cameraStream])

  useEffect(() => {
    return () => { cameraStream?.getTracks().forEach(t => t.stop()) }
  }, [cameraStream])

  const abrirCamara = async () => {
    setErrorCamara(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } }
      })
      setCameraStream(stream)
    } catch {
      setErrorCamara('No se pudo acceder a la cámara')
    }
  }

  const capturarFoto = () => {
    if (!videoRef.current) return
    const video = videoRef.current
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth || 640
    canvas.height = video.videoHeight || 480
    canvas.getContext('2d')?.drawImage(video, 0, 0)
    setFotoDataUrl(canvas.toDataURL('image/jpeg', 0.8))
    cameraStream?.getTracks().forEach(t => t.stop())
    setCameraStream(null)
  }

  const handleCancelar = () => {
    cameraStream?.getTracks().forEach(t => t.stop())
    setCameraStream(null)
    setFotoDataUrl(null)
    onCancelar()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/50" onClick={handleCancelar}>
      <div
        className="w-full bg-white rounded-t-3xl p-6 space-y-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto" />
        <h3 className="text-base font-semibold text-slate-900">Foto de evidencia</h3>
        <p className="text-sm text-slate-500">
          Toma una foto del trabajo terminado para completar la tarea.
        </p>

        {!cameraStream && !fotoDataUrl && (
          <button
            onClick={abrirCamara}
            className="w-full rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 py-10 text-center text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <span className="text-3xl block mb-2">📸</span>
            Tomar foto de evidencia
          </button>
        )}

        {errorCamara && (
          <p className="text-sm text-red-600 text-center">{errorCamara}</p>
        )}

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

        {fotoDataUrl && (
          <div className="space-y-3">
            <div className="relative rounded-2xl overflow-hidden">
              <img src={fotoDataUrl} alt="Evidencia" className="w-full h-52 object-cover" />
              <button
                onClick={() => setFotoDataUrl(null)}
                className="absolute top-2 right-2 rounded-full bg-black/60 px-2 py-1 text-xs text-white hover:bg-black/80"
              >
                ✕ Repetir
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