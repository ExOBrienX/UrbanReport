'use client'

import { useEffect, useRef, useState } from 'react'
import {
  LocationResult,
  requestCameraPermission,
  requestLocationPermission,
} from '@/app/lib/permissions'

interface ReportModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function ReportModal({ isOpen, onClose }: ReportModalProps) {
  const [description, setDescription] = useState('')
  const [coords, setCoords] = useState<LocationResult | null>(null)
  const [locationState, setLocationState] = useState('Obteniendo ubicación...')
  const [cameraState, setCameraState] = useState('No capturada')
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null)
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null)
  const [submitMessage, setSubmitMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    if (!isOpen) return

    const getLocation = async () => {
      try {
        const location = await requestLocationPermission()
        setCoords(location)
        setLocationState('Ubicación obtenida')
      } catch (error) {
        setLocationState('No se pudo obtener ubicación')
      }
    }

    getLocation()
  }, [isOpen])

  useEffect(() => {
    if (videoRef.current && cameraStream) {
      videoRef.current.srcObject = cameraStream
      videoRef.current.play().catch(() => {})
    }
  }, [cameraStream])

  useEffect(() => {
    return () => {
      cameraStream?.getTracks().forEach((track) => track.stop())
    }
  }, [cameraStream])

  const openCamera = async () => {
    setCameraState('Solicitando permiso...')
    try {
      const stream = await requestCameraPermission()
      setCameraStream(stream)
      setCameraState('Cámara activa')
    } catch (error) {
      setCameraState('No se pudo abrir cámara')
    }
  }

  const capturePhoto = () => {
    if (!videoRef.current) return

    const video = videoRef.current
    const canvas = canvasRef.current ?? document.createElement('canvas')
    canvas.width = video.videoWidth || 640
    canvas.height = video.videoHeight || 480
    const context = canvas.getContext('2d')

    if (!context) return

    context.drawImage(video, 0, 0, canvas.width, canvas.height)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.8)
    setPhotoDataUrl(dataUrl)
    setCameraState('Foto capturada')
    cameraStream?.getTracks().forEach((track) => track.stop())
    setCameraStream(null)
  }

 const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault()
  setSubmitMessage(null)

  if (!description.trim()) {
    setSubmitMessage('Describe el problema')
    return
  }

  if (!photoDataUrl) {
    setSubmitMessage('Captura una foto')
    return
  }

  if (!coords) {
    setSubmitMessage('Ubicación no disponible')
    return
  }

  setIsSubmitting(true)

  try {
    // Convertir dataUrl a File para enviar como form-data
    const response = await fetch(photoDataUrl)
    const blob = await response.blob()
    const fotoFile = new File([blob], 'foto.jpg', { type: 'image/jpeg' })

    // Armar el formData
    const formData = new FormData()
    formData.append('foto', fotoFile)
    formData.append('descripcion', description.trim())
    formData.append('latitud', String(coords.latitude))
    formData.append('longitud', String(coords.longitude))
    formData.append('categoriaId', '1') // temporal hasta integrar IA

    // Llamar al endpoint POST /api/reports
    const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/reports`, {
      method: 'POST',
      body: formData,
    })

    if (!res.ok) {
      const data = await res.json()
      setSubmitMessage(data.error || 'Error al enviar el reporte')
      return
    }

    setShowSuccess(true)

  } catch (error) {
    setSubmitMessage('Error de conexión, intenta nuevamente')
  } finally {
    setIsSubmitting(false)
  }
}
  const handleClose = () => {
    cameraStream?.getTracks().forEach((track) => track.stop())
    setCameraStream(null)
    setDescription('')
    setPhotoDataUrl(null)
    setSubmitMessage(null)
    setCameraState('No capturada')
    setShowSuccess(false)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[9999] flex items-end bg-black/50 md:items-center">
      <div className="w-full max-w-md rounded-t-3xl bg-white md:rounded-3xl md:shadow-lg">
        <div className="relative flex items-center justify-between border-b border-slate-200 p-4">
          <h2 className="text-lg font-semibold text-slate-900">
            {showSuccess ? '¡Reporte enviado!' : 'Nuevo reporte'}
          </h2>
          {!showSuccess && (
            <button
              onClick={handleClose}
              className="inline-flex h-8 w-8 items-center justify-center text-slate-500 hover:text-slate-700"
            >
              ✕
            </button>
          )}
        </div>

        {showSuccess ? (
          <div className="flex flex-col items-center justify-center space-y-6 p-8">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <span className="text-3xl">✓</span>
            </div>
            <p className="text-center text-slate-700">
              Tu reporte fue enviado correctamente. Lo revisaremos y actualizaremos su estado en el mapa.
            </p>
            <button
              onClick={handleClose}
              className="w-full rounded-lg bg-slate-900 py-3 text-center font-medium text-white hover:bg-slate-700"
            >
              — Volver al mapa
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 overflow-y-auto p-4 md:max-h-96">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-sm font-medium text-slate-700">📍 Ubicación</p>
            <p className="mt-1 text-sm text-slate-600">{locationState}</p>
            {coords && (
              <p className="mt-1 text-xs text-slate-500">
                {coords.latitude.toFixed(4)}, {coords.longitude.toFixed(4)}
              </p>
            )}
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-sm font-medium text-slate-700 mb-3">📷 Foto del problema</p>

            {!cameraStream && !photoDataUrl && (
              <button
                type="button"
                onClick={openCamera}
                className="w-full rounded-lg border-2 border-dashed border-slate-300 bg-white py-6 text-center text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                📸 Tomar foto
                <p className="text-xs text-slate-500 mt-1">Foto obligatoria</p>
              </button>
            )}

            {cameraStream && (
              <div className="space-y-2">
                <video
                  ref={videoRef}
                  className="w-full rounded-lg border border-slate-300 bg-black"
                  autoPlay
                  playsInline
                  muted
                />
                <button
                  type="button"
                  onClick={capturePhoto}
                  className="w-full rounded-lg bg-amber-600 py-2 text-sm font-medium text-white hover:bg-amber-500"
                >
                  Capturar
                </button>
              </div>
            )}

            {photoDataUrl && (
              <div className="relative rounded-lg overflow-hidden border border-slate-300">
                <img
                  src={photoDataUrl}
                  alt="Foto capturada"
                  className="w-full h-40 object-cover"
                />
                <button
                  type="button"
                  onClick={() => {
                    setPhotoDataUrl(null)
                    setCameraState('No capturada')
                  }}
                  className="absolute top-1 right-1 rounded-full bg-black/60 p-1 text-white text-xs hover:bg-black/80"
                >
                  ✕
                </button>
              </div>
            )}
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium text-slate-700 mb-2">
              Describir el problema
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-slate-900 focus:outline-none"
              placeholder="Describe qué está pasando..."
            />
          </div>

          {submitMessage && (
            <p className="rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-700">
              {submitMessage}
            </p>
          )}

          <div className="flex gap-2 pt-4">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 rounded-lg border border-slate-300 bg-white py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 rounded-lg bg-slate-900 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:bg-slate-400"
            >
              {isSubmitting ? 'Enviando...' : 'Enviar reporte'}
            </button>
          </div>
            </form>
        )}
      </div>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  )
}
