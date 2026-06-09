'use client'

import { useEffect, useState, useCallback } from 'react'
import ModalHistorialTareas from './ModalHistorialTareas'

interface Especialidad {
  categoria: { id: number; nombre: string }
}

interface Tecnico {
  id: number
  nombre: string
  email: string
  rut: string
  telefono: string | null
  activo: boolean
  creado_en: string
  especialidades: Especialidad[]
  tareas: { id: number; estado: string }[]
}

interface Categoria {
  id: number
  nombre: string
}

const CAT_COLORS: Record<string, string> = {
  'Pavimento':    'bg-slate-700 text-white',
  'Veredas':      'bg-blue-600 text-white',
  'Areas Verdes': 'bg-green-600 text-white',
  'Senaletica':   'bg-amber-500 text-white',
  'Residuos':     'bg-orange-500 text-white',
  'Mobiliario':   'bg-purple-600 text-white',
}

// Errores de validación por campo
interface FormErrors {
  nombre?: string
  email?: string
  password?: string
  rut?: string
  telefono?: string
}

export default function GestionTecnicos() {
  const [tecnicos, setTecnicos] = useState<Tecnico[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [tecnicoHistorial, setTecnicoHistorial] = useState<Tecnico | null>(null)
  const [showModalForm, setShowModalForm] = useState(false)
  const [tecnicoEditar, setTecnicoEditar] = useState<Tecnico | null>(null)
  const [form, setForm] = useState({ nombre: '', email: '', password: '', rut: '', telefono: '' })
  const [formErrors, setFormErrors] = useState<FormErrors>({})
  const [procesando, setProcesando] = useState(false)
  const [showModalEstado, setShowModalEstado] = useState(false)
  const [tecnicoEstado, setTecnicoEstado] = useState<Tecnico | null>(null)
  const [showModalEspecialidades, setShowModalEspecialidades] = useState(false)
  const [tecnicoEspecialidades, setTecnicoEspecialidades] = useState<Tecnico | null>(null)
  const [especialidadesLocales, setEspecialidadesLocales] = useState<number[]>([])
  const [procesandoEsp, setProcesandoEsp] = useState(false)
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)

  const mostrarMensaje = (tipo: 'ok' | 'error', texto: string) => {
    setMensaje({ tipo, texto })
    setTimeout(() => setMensaje(null), 4000)
  }

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const [tecRes, catRes] = await Promise.all([
        fetch('/api/admin/tecnicos'),
        fetch('/api/categorias')
      ])
      const tecData = await tecRes.json()
      const catData = await catRes.json()
      if (tecData.success) setTecnicos(tecData.tecnicos)
      if (catData.categorias) setCategorias(catData.categorias)
      return tecData.tecnicos as Tecnico[]
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const abrirModalCrear = () => {
    setTecnicoEditar(null)
    setForm({ nombre: '', email: '', password: '', rut: '', telefono: '' })
    setFormErrors({})
    setShowModalForm(true)
  }

  const abrirModalEditar = (tecnico: Tecnico) => {
    setTecnicoEditar(tecnico)
    setForm({ nombre: tecnico.nombre, email: tecnico.email, password: '', rut: tecnico.rut, telefono: tecnico.telefono ?? '' })
    setFormErrors({})
    setShowModalForm(true)
  }

  // Validar campo en tiempo real al escribir
  const handleChangeForm = (key: string, value: string) => {
    setForm(prev => ({ ...prev, [key]: value }))
    // Limpiar error del campo al empezar a escribir
    if (formErrors[key as keyof FormErrors]) {
      setFormErrors(prev => ({ ...prev, [key]: undefined }))
    }
  }

  // Validación completa del formulario — retorna true si es válido
  const validarForm = (): boolean => {
    const errors: FormErrors = {}

    // Nombre — mínimo 3 caracteres
    if (!form.nombre.trim() || form.nombre.trim().length < 3) {
      errors.nombre = 'El nombre debe tener al menos 3 caracteres'
    }

    // Email — formato válido
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(form.email)) {
      errors.email = 'Ingresa un email válido'
    }

    // RUT — formato chileno 12345678-9 (7 u 8 dígitos + guión + dígito verificador)
    const rutRegex = /^\d{7,8}-[\dkK]$/
    if (!rutRegex.test(form.rut)) {
      errors.rut = 'Formato inválido. Usa 12345678-9'
    }

    // Contraseña — obligatoria al crear, mínimo 6 caracteres
    if (!tecnicoEditar && form.password.length < 6) {
      errors.password = 'La contraseña debe tener al menos 6 caracteres'
    }
    if (tecnicoEditar && form.password && form.password.length < 6) {
      errors.password = 'La nueva contraseña debe tener al menos 6 caracteres'
    }

    // Teléfono — opcional, pero si se ingresa debe tener formato válido
    if (form.telefono && !/^\+?[\d\s\-]{8,12}$/.test(form.telefono)) {
      errors.telefono = 'Formato inválido. Usa +56912345678'
    }

    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleGuardar = async () => {
    if (!validarForm()) return

    setProcesando(true)
    try {
      if (tecnicoEditar) {
        const body: any = { accion: 'editar', nombre: form.nombre.trim(), email: form.email.trim(), telefono: form.telefono.trim() || null }
        if (form.password) body.password = form.password
        const res = await fetch(`/api/admin/tecnicos/${tecnicoEditar.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        })
        const data = await res.json()
        if (!res.ok) { mostrarMensaje('error', data.error); return }
        mostrarMensaje('ok', '✅ Técnico actualizado correctamente')
      } else {
        const res = await fetch('/api/admin/tecnicos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...form, nombre: form.nombre.trim(), email: form.email.trim() })
        })
        const data = await res.json()
        if (!res.ok) { mostrarMensaje('error', data.error); return }
        mostrarMensaje('ok', '✅ Técnico creado correctamente')
      }
      setShowModalForm(false)
      cargar()
    } finally {
      setProcesando(false)
    }
  }

  const handleCambiarEstado = async () => {
    if (!tecnicoEstado) return
    setProcesando(true)
    try {
      const accion = tecnicoEstado.activo ? 'desactivar' : 'activar'
      const res = await fetch(`/api/admin/tecnicos/${tecnicoEstado.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion })
      })
      const data = await res.json()
      if (!res.ok) { mostrarMensaje('error', data.error); return }
      mostrarMensaje('ok', `✅ Técnico ${tecnicoEstado.activo ? 'desactivado' : 'activado'} correctamente`)
      setShowModalEstado(false)
      setTecnicoEstado(null)
      cargar()
    } finally {
      setProcesando(false)
    }
  }

  const handleToggleEspecialidadLocal = (categoriaId: number) => {
    setEspecialidadesLocales(prev =>
      prev.includes(categoriaId)
        ? prev.filter(id => id !== categoriaId)
        : [...prev, categoriaId]
    )
  }

  const handleGuardarEspecialidades = async () => {
    if (!tecnicoEspecialidades) return
    setProcesandoEsp(true)
    try {
      const originales = tecnicoEspecialidades.especialidades.map(e => e.categoria.id)
      const agregar = especialidadesLocales.filter(id => !originales.includes(id))
      const quitar = originales.filter(id => !especialidadesLocales.includes(id))

      await Promise.all([
        ...agregar.map(id => fetch(`/api/admin/tecnicos/${tecnicoEspecialidades.id}/especialidades`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ categoriaId: id })
        })),
        ...quitar.map(id => fetch(`/api/admin/tecnicos/${tecnicoEspecialidades.id}/especialidades`, {
          method: 'DELETE', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ categoriaId: id })
        }))
      ])

      mostrarMensaje('ok', '✅ Especialidades actualizadas')
      setShowModalEspecialidades(false)
      cargar()
    } finally {
      setProcesandoEsp(false)
    }
  }

  const tecnicosFiltrados = tecnicos.filter(t =>
    t.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    t.email.toLowerCase().includes(busqueda.toLowerCase()) ||
    t.rut.toLowerCase().includes(busqueda.toLowerCase())
  )

  // Configuración de campos del formulario con maxLength
  const CAMPOS_FORM = [
    { label: 'Nombre completo', key: 'nombre', type: 'text', placeholder: 'Juan Pérez', maxLength: 100 },
    { label: 'Email', key: 'email', type: 'email', placeholder: 'juan@urbanreport.cl', maxLength: 100 },
    { label: `Contraseña${tecnicoEditar ? ' (vacío = no cambiar)' : ''}`, key: 'password', type: 'password', placeholder: '••••••••', maxLength: 50 },
    { label: 'RUT', key: 'rut', type: 'text', placeholder: '12345678-9', maxLength: 10, disabled: !!tecnicoEditar },
    { label: 'Teléfono (opcional)', key: 'telefono', type: 'text', placeholder: '+56912345678', maxLength: 12 },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Gestión de técnicos</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {tecnicos.length} técnico{tecnicos.length !== 1 ? 's' : ''} — {tecnicos.filter(t => t.activo).length} activo{tecnicos.filter(t => t.activo).length !== 1 ? 's' : ''}
          </p>
        </div>
        <button onClick={abrirModalCrear} className="bg-slate-900 text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-slate-700 transition-colors">
          + Nuevo técnico
        </button>
      </div>

      {mensaje && (
        <div className={`rounded-xl px-4 py-3 text-sm font-medium border ${mensaje.tipo === 'ok' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
          {mensaje.texto}
        </div>
      )}

      <input type="text" value={busqueda} onChange={e => setBusqueda(e.target.value)}
        placeholder="Buscar por nombre, email o RUT..."
        className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-700 outline-none focus:border-slate-400 transition-colors"
      />

      {loading ? (
        <div className="space-y-2">
          {[1,2,3].map(i => <div key={i} className="h-16 bg-slate-100 rounded-2xl animate-pulse" />)}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="grid grid-cols-12 gap-4 px-5 py-3 bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-400 uppercase tracking-wider">
            <div className="col-span-3">Técnico</div>
            <div className="col-span-2">RUT</div>
            <div className="col-span-3">Especialidades</div>
            <div className="col-span-1 text-center">Estado</div>
            <div className="col-span-3 text-right">Acciones</div>
          </div>

          <div className="divide-y divide-slate-100">
            {tecnicosFiltrados.map(tecnico => (
              <div key={tecnico.id}
                className="grid grid-cols-12 gap-4 px-5 py-4 items-center hover:bg-slate-50 transition-colors cursor-pointer"
                onClick={() => setTecnicoHistorial(tecnico)}
              >
                <div className="col-span-3 flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-black flex-shrink-0 ${tecnico.activo ? 'bg-slate-900 text-white' : 'bg-slate-200 text-slate-400'}`}>
                    {tecnico.nombre.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">{tecnico.nombre}</p>
                    <p className="text-xs text-slate-400 truncate">{tecnico.email}</p>
                  </div>
                </div>
                <div className="col-span-2">
                  <span className="text-sm text-slate-600 font-mono">{tecnico.rut}</span>
                </div>
                <div className="col-span-3 flex flex-wrap gap-1">
                  {tecnico.especialidades.length === 0 ? (
                    <span className="text-xs text-slate-400 italic">Sin especialidades</span>
                  ) : (
                    tecnico.especialidades.map(e => (
                      <span key={e.categoria.id} className={`text-xs font-semibold px-2 py-0.5 rounded-full ${CAT_COLORS[e.categoria.nombre] ?? 'bg-slate-200 text-slate-700'}`}>
                        {e.categoria.nombre}
                      </span>
                    ))
                  )}
                </div>
                <div className="col-span-1 text-center">
                  <span className={`text-xs font-bold px-2 py-1 rounded-full ${tecnico.activo ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-400'}`}>
                    {tecnico.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </div>
                <div className="col-span-3 flex justify-end gap-2" onClick={e => e.stopPropagation()}>
                  <button
                    onClick={() => { setTecnicoEspecialidades(tecnico); setEspecialidadesLocales(tecnico.especialidades.map(e => e.categoria.id)); setShowModalEspecialidades(true) }}
                    className="text-xs text-blue-600 hover:text-blue-800 border border-blue-200 hover:border-blue-400 hover:bg-blue-50 rounded-lg px-3 py-1.5 transition-all"
                  >
                    Especialidades
                  </button>
                  <button onClick={() => abrirModalEditar(tecnico)}
                    className="text-xs text-slate-600 hover:text-slate-900 border border-slate-200 hover:border-slate-400 rounded-lg px-3 py-1.5 transition-all">
                    Editar
                  </button>
                  <button
                    onClick={() => { setTecnicoEstado(tecnico); setShowModalEstado(true) }}
                    className={`text-xs border rounded-lg px-3 py-1.5 transition-all ${tecnico.activo ? 'text-red-500 border-red-200 hover:bg-red-50' : 'text-green-600 border-green-200 hover:bg-green-50'}`}
                  >
                    {tecnico.activo ? 'Desactivar' : 'Activar'}
                  </button>
                </div>
              </div>
            ))}
            {tecnicosFiltrados.length === 0 && (
              <div className="px-5 py-12 text-center">
                <p className="text-slate-400 text-sm">No se encontraron técnicos</p>
              </div>
            )}
          </div>
        </div>
      )}

      {tecnicoHistorial && (
        <ModalHistorialTareas tecnico={tecnicoHistorial} onCerrar={() => setTecnicoHistorial(null)} />
      )}

      {/* Modal crear/editar */}
      {showModalForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={() => setShowModalForm(false)}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">{tecnicoEditar ? 'Editar técnico' : 'Nuevo técnico'}</h3>
              <button onClick={() => setShowModalForm(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-400">✕</button>
            </div>

            <div className="space-y-3">
              {CAMPOS_FORM.map(field => (
                <div key={field.key}>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">{field.label}</label>
                  <input
                    type={field.type}
                    value={form[field.key as keyof typeof form]}
                    onChange={e => handleChangeForm(field.key, e.target.value)}
                    placeholder={field.placeholder}
                    maxLength={field.maxLength}
                    disabled={field.disabled}
                    className={`w-full border-2 rounded-xl px-4 py-2.5 text-sm text-slate-700 outline-none transition-colors disabled:bg-slate-50 disabled:text-slate-400 ${
                      formErrors[field.key as keyof FormErrors]
                        ? 'border-red-400 focus:border-red-500'
                        : 'border-slate-200 focus:border-slate-900'
                    }`}
                  />
                  {/* Mensaje de error por campo */}
                  {formErrors[field.key as keyof FormErrors] && (
                    <p className="text-xs text-red-500 mt-1">{formErrors[field.key as keyof FormErrors]}</p>
                  )}
                  {/* Contador de caracteres para campos con límite visible */}
                  {(field.key === 'rut' || field.key === 'telefono') && form[field.key as keyof typeof form] && (
                    <p className="text-xs text-slate-400 mt-0.5 text-right">
                      {form[field.key as keyof typeof form].length}/{field.maxLength}
                    </p>
                  )}
                </div>
              ))}
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowModalForm(false)} className="flex-1 border-2 border-slate-200 rounded-2xl py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50">
                Cancelar
              </button>
              <button onClick={handleGuardar} disabled={procesando}
                className="flex-1 bg-slate-900 text-white rounded-2xl py-3 text-sm font-bold hover:bg-slate-700 disabled:bg-slate-200 transition-all">
                {procesando ? 'Guardando...' : tecnicoEditar ? 'Guardar cambios' : 'Crear técnico'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal desactivar/activar */}
      {showModalEstado && tecnicoEstado && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={() => setShowModalEstado(false)}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-bold text-slate-900">
              {tecnicoEstado.activo ? 'Desactivar técnico' : 'Activar técnico'}
            </h3>
            <div className={`rounded-xl p-4 border ${tecnicoEstado.activo ? 'bg-red-50 border-red-100' : 'bg-green-50 border-green-100'}`}>
              <p className={`text-sm ${tecnicoEstado.activo ? 'text-red-700' : 'text-green-700'}`}>
                {tecnicoEstado.activo
                  ? `Al desactivar a ${tecnicoEstado.nombre}, no podrá iniciar sesión ni recibir nuevas tareas. Las tareas activas deben cancelarse primero.`
                  : `Al activar a ${tecnicoEstado.nombre}, podrá volver a iniciar sesión y recibir tareas.`
                }
              </p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowModalEstado(false)} className="flex-1 border-2 border-slate-200 rounded-2xl py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50">
                Cancelar
              </button>
              <button onClick={handleCambiarEstado} disabled={procesando}
                className={`flex-1 text-white rounded-2xl py-3 text-sm font-bold transition-all disabled:bg-slate-200 ${tecnicoEstado.activo ? 'bg-red-500 hover:bg-red-600' : 'bg-green-600 hover:bg-green-700'}`}>
                {procesando ? 'Procesando...' : tecnicoEstado.activo ? 'Confirmar desactivación' : 'Confirmar activación'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal especialidades */}
      {showModalEspecialidades && tecnicoEspecialidades && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={() => setShowModalEspecialidades(false)}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">Especialidades</h3>
                <p className="text-xs text-slate-400">{tecnicoEspecialidades.nombre}</p>
              </div>
              <button onClick={() => setShowModalEspecialidades(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-400">✕</button>
            </div>
            <p className="text-sm text-slate-500">Selecciona las categorías y confirma con "Guardar".</p>
            <div className="space-y-2">
              {categorias.map(cat => {
                const tieneEsp = especialidadesLocales.includes(cat.id)
                return (
                  <button key={cat.id} onClick={() => handleToggleEspecialidadLocal(cat.id)} disabled={procesandoEsp}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-all ${tieneEsp ? 'border-slate-900 bg-slate-50' : 'border-slate-200 hover:border-slate-300'} ${procesandoEsp ? 'opacity-60 cursor-wait' : ''}`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`w-5 h-5 rounded flex items-center justify-center text-xs font-bold flex-shrink-0 transition-all ${tieneEsp ? 'bg-slate-900 text-white' : 'border-2 border-slate-300'}`}>
                        {tieneEsp ? '✓' : ''}
                      </span>
                      <span className={`text-sm font-semibold ${tieneEsp ? 'text-slate-900' : 'text-slate-500'}`}>{cat.nombre}</span>
                    </div>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${CAT_COLORS[cat.nombre] ?? 'bg-slate-200 text-slate-700'}`}>
                      {cat.nombre}
                    </span>
                  </button>
                )
              })}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowModalEspecialidades(false)}
                className="flex-1 border-2 border-slate-200 rounded-2xl py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50">
                Cancelar
              </button>
              <button onClick={handleGuardarEspecialidades} disabled={procesandoEsp}
                className="flex-1 bg-slate-900 text-white rounded-2xl py-3 text-sm font-bold hover:bg-slate-700 disabled:bg-slate-200 transition-all">
                {procesandoEsp ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}