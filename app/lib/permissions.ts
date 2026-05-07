export interface LocationResult {
  latitude: number;
  longitude: number;
  accuracy?: number;
}

export async function requestLocationPermission(): Promise<LocationResult> {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') {
    throw new Error('Location permission can only be requested in the browser.');
  }

  if (!('geolocation' in navigator)) {
    throw new Error('Geolocation is not supported by this browser.');
  }

  return new Promise<LocationResult>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        resolve({ latitude, longitude, accuracy });
      },
      (error) => {
        switch (error.code) {
          case error.PERMISSION_DENIED:
            reject(new Error('Location permission was denied.'));
            break;
          case error.POSITION_UNAVAILABLE:
            reject(new Error('Location position is unavailable.'));
            break;
          case error.TIMEOUT:
            reject(new Error('Location request timed out.'));
            break;
          default:
            reject(new Error('An unknown location error occurred.'));
            break;
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  });
}

export async function requestCameraPermission(): Promise<MediaStream> {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') {
    throw new Error('Camera permission can only be requested in the browser.');
  }

  if (!('mediaDevices' in navigator) || !navigator.mediaDevices?.getUserMedia) {
    throw new Error('Camera access is not supported by this browser.');
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    return stream;
  } catch (error: unknown) {
    if (error instanceof DOMException) {
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        throw new Error('Camera permission was denied.');
      }
      if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        throw new Error('No camera device was found.');
      }
      if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
        throw new Error('The camera is already in use or cannot be accessed.');
      }
    }

    throw new Error('An error occurred while requesting camera permission.');
  }
}
