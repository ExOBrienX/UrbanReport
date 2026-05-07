'use client';

import { useEffect, useRef, useState } from 'react';
import {
  LocationResult,
  requestCameraPermission,
  requestLocationPermission,
} from '../lib/permissions';

export default function TestPermisosPage() {
  const [locationState, setLocationState] = useState('Esperando apertura de la pagina...');
  const [cameraState, setCameraState] = useState('Pendiente de prueba');
  const [coords, setCoords] = useState<LocationResult | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const requestLocation = async () => {
      setLocationState('Solicitando permiso de ubicacion...');

      try {
        const result = await requestLocationPermission();
        setCoords(result);
        setLocationState('Permiso de ubicacion concedido.');
      } catch (error) {
        setLocationState(
          error instanceof Error
            ? error.message
            : 'Error desconocido al solicitar ubicacion.'
        );
      }
    };

    requestLocation();
  }, []);

  useEffect(() => {
    if (videoRef.current && cameraStream) {
      videoRef.current.srcObject = cameraStream;
      videoRef.current.play().catch(() => {
        // Ignorar error si el autoplay se bloquea
      });
    }
  }, [cameraStream]);

  useEffect(() => {
    return () => {
      cameraStream?.getTracks().forEach((track) => track.stop());
    };
  }, [cameraStream]);

  const requestCamera = async () => {
    setCameraState('Solicitando permiso de camara...');

    try {
      const stream = await requestCameraPermission();
      setCameraStream(stream);
      setCameraState('Permiso de camara concedido.');
    } catch (error) {
      setCameraState(
        error instanceof Error
          ? error.message
          : 'Error desconocido al solicitar camara.'
      );
    }
  };

  const requestLocationAgain = async () => {
    setLocationState('Reintentando permiso de ubicacion...');

    try {
      const result = await requestLocationPermission();
      setCoords(result);
      setLocationState('Permiso de ubicacion concedido.');
    } catch (error) {
      setLocationState(
        error instanceof Error
          ? error.message
          : 'Error desconocido al solicitar ubicacion.'
      );
    }
  };

  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="text-3xl font-semibold mb-6">Pagina de prueba de permisos</h1>

      <section className="mb-8">
        <h2 className="text-xl font-medium mb-2">Ubicacion</h2>
        <p className="mb-2">Estado: {locationState}</p>
        {coords && (
          <div className="mb-2 text-sm text-slate-700">
            <p>Latitud: {coords.latitude}</p>
            <p>Longitud: {coords.longitude}</p>
            <p>Precision: {coords.accuracy ?? 'N/A'} m</p>
          </div>
        )}
        <button
          type="button"
          onClick={requestLocationAgain}
          className="rounded bg-slate-900 px-4 py-2 text-white hover:bg-slate-700"
        >
          Reintentar ubicacion
        </button>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-medium mb-2">Camara</h2>
        <p className="mb-2">Estado: {cameraState}</p>
        <button
          type="button"
          onClick={requestCamera}
          className="rounded bg-slate-900 px-4 py-2 text-white hover:bg-slate-700"
        >
          Pedir permiso de camara
        </button>
        {cameraStream && (
          <div className="mt-4">
            <video
              ref={videoRef}
              className="w-full max-w-md rounded border border-slate-300"
              autoPlay
              muted
              playsInline
            />
          </div>
        )}
      </section>

      <section className="text-sm text-slate-600">
        <p>La ubicacion se solicita automaticamente al abrir la pagina.</p>
        <p>La camara se solicita desde el boton para evitar bloqueos por autoplay o requisitos de gesto del usuario.</p>
      </section>
    </main>
  );
}
