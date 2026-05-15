'use client'

import { useState } from 'react'
import { signIn, getSession } from 'next-auth/react'

export default function AccesoPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')

  const handleLogin = async () => {
    setStatus('loading')
    setMessage('')

    const response = await signIn('credentials', {
      redirect: false,
      email,
      password,
    })

    if (!response?.ok) {
      setStatus('error')
      setMessage('Correo o contraseña incorrectos.')
      return
    }

    const session = await getSession()
    const role = session?.user?.role

    if (role === 'admin') {
      setStatus('success')
      setMessage('Acceso exitoso como administrador.')
    } else if (role === 'tecnico') {
      setStatus('success')
      setMessage('Acceso exitoso en el módulo de técnico.')
    } else {
      setStatus('error')
      setMessage('Acceso válido, pero el rol no está autorizado.')
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm bg-white rounded-3xl border border-slate-200 shadow-xl shadow-slate-200/40 overflow-hidden">
        <div className="p-8 text-center">
          <div className="mx-auto mb-6 h-16 w-16 rounded-3xl bg-blue-600 text-white flex items-center justify-center text-3xl font-bold">
            U
          </div>
          <h1 className="text-2xl font-semibold text-slate-900">UrbanReport</h1>
          <p className="mt-2 text-sm text-slate-500">Acceso solo para funcionarios municipales</p>
        </div>

        <div className="space-y-4 p-6">
          <label className="block text-sm font-medium text-slate-700">Correo electrónico</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Ingresa tu correo"
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />

          <label className="block text-sm font-medium text-slate-700">Contraseña</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Ingresa tu contraseña"
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />

          <button
            type="button"
            onClick={handleLogin}
            disabled={status === 'loading'}
            className="w-full rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            {status === 'loading' ? 'Validando...' : 'Ingresar →'}
          </button>

          {status === 'success' && (
            <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
              {message}
            </div>
          )}

          {status === 'error' && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
              {message}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
