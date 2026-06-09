/**
 * permissions.ts — Utilidades para solicitar permisos de ubicacion y camara.
 *
 * Abstrae la API del navegador para geolocation y mediaDevices,
 * traduciendo los errores nativos a mensajes comprensibles.
 *
 * Compatibilidad movil:
 *   - iOS Safari requiere HTTPS y que la solicitud venga de una interaccion del usuario
 *   - La camara trasera se solicita con facingMode 'environment' pero con fallback
 *     a cualquier camara, ya que iOS Safari a veces rechaza el constraint ideal
 *   - El header Permissions-Policy en next.config.ts habilita camara y geolocalizacion
 *
 * Usado por: app/components/ui/Ciudadano/ReportModal.tsx,
 *            app/tecnico/components/EvidenciaModal.tsx
 */

export interface LocationResult {
  latitude: number
  longitude: number
  accuracy?: number
}

/**
 * Solicita permiso de ubicacion GPS y retorna las coordenadas actuales.
 * Lanza un error descriptivo si el permiso es denegado o no disponible.
 */
export async function requestLocationPermission(): Promise<LocationResult> {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') {
    throw new Error('Location permission can only be requested in the browser.')
  }

  if (!('geolocation' in navigator)) {
    throw new Error('Geolocation is not supported by this browser.')
  }

  return new Promise<LocationResult>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords
        resolve({ latitude, longitude, accuracy })
      },
      (error) => {
        switch (error.code) {
          case error.PERMISSION_DENIED:
            reject(new Error('Location permission was denied.'))
            break
          case error.POSITION_UNAVAILABLE:
            reject(new Error('Location position is unavailable.'))
            break
          case error.TIMEOUT:
            reject(new Error('Location request timed out.'))
            break
          default:
            reject(new Error('An unknown location error occurred.'))
            break
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    )
  })
}

/**
 * Solicita acceso a la camara del dispositivo y retorna el MediaStream.
 *
 * Estrategia de camara:
 *   1. Intenta camara trasera con facingMode 'environment' (ideal para movil)
 *   2. Si falla (iOS Safari a veces rechaza el constraint), hace fallback
 *      a cualquier camara disponible sin restriccion de orientacion
 *
 * Lanza un error descriptivo si el permiso es denegado, no hay camara
 * disponible o la camara esta en uso por otra aplicacion.
 */
export async function requestCameraPermission(): Promise<MediaStream> {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') {
    throw new Error('Camera permission can only be requested in the browser.')
  }

  if (!('mediaDevices' in navigator) || !navigator.mediaDevices?.getUserMedia) {
    throw new Error('Camera access is not supported by this browser.')
  }

  try {
    let stream: MediaStream
    try {
      // Primer intento: camara trasera (preferida en dispositivos moviles)
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } }
      })
    } catch {
      // Fallback: cualquier camara — iOS Safari puede rechazar el constraint ideal
      stream = await navigator.mediaDevices.getUserMedia({ video: true })
    }
    return stream
  } catch (error: unknown) {
    if (error instanceof DOMException) {
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        throw new Error('Camera permission was denied.')
      }
      if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        throw new Error('No camera device was found.')
      }
      if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
        throw new Error('The camera is already in use or cannot be accessed.')
      }
    }
    throw new Error('An error occurred while requesting camera permission.')
  }
}