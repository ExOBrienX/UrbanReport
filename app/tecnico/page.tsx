'use client'

import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function TecnicoPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/acceso')
  }, [status, router])

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-sm text-slate-500">Cargando...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-lg p-8 w-full max-w-sm text-center space-y-4">
        <div className="h-16 w-16 rounded-3xl bg-slate-900 text-white flex items-center justify-center text-xl font-bold mx-auto">
          UR
        </div>
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wide">Panel</p>
          <h1 className="text-2xl font-semibold text-slate-900">Técnico</h1>
        </div>
        <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4 text-left space-y-1">
          <p className="text-sm text-slate-700">
            <span className="font-medium">Nombre:</span> {session?.user?.nombre}
          </p>
          <p className="text-sm text-slate-700">
            <span className="font-medium">Email:</span> {session?.user?.email}
          </p>
          <p className="text-sm text-slate-700">
            <span className="font-medium">Rol:</span> {session?.user?.role}
          </p>
        </div>
        <p className="text-xs text-slate-400">
          Etapa 4 en construcción — cola de tareas próximamente
        </p>
        <button
          onClick={() => signOut({ callbackUrl: '/acceso' })}
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
        >
          Cerrar sesión
        </button>
      </div>
    </div>
  )
}