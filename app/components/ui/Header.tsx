'use client'

import Link from 'next/link'

interface HeaderProps {
  isDarkMode: boolean
}

export default function Header({ isDarkMode }: HeaderProps) {
  return (
    <header className={`fixed top-0 left-0 right-0 z-50 backdrop-blur-sm border-b shadow-sm transition-colors ${
      isDarkMode 
        ? 'bg-slate-900/95 border-slate-700 text-white' 
        : 'bg-white/95 border-slate-200 text-slate-900'
    }`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo y título */}
          <div className="flex items-center space-x-3">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm ${
              isDarkMode ? 'bg-white text-slate-900' : 'bg-slate-900 text-white'
            }`}>
              UR
            </div>
            <h1 className="text-xl font-bold">Urban Report</h1>
          </div>

          {/* Navegación */}
          <nav className="flex items-center space-x-4">
            {/* Enlace escondido para técnicos/administradores */}
            <Link
              href="/acceso"
              className={`text-xs hover:text-slate-700 transition-colors opacity-60 hover:opacity-100 ${
                isDarkMode ? 'text-slate-400' : 'text-slate-500'
              }`}
              title="Acceso para técnicos y administradores"
            >
              Acceso técnico
            </Link>
          </nav>
        </div>
      </div>
    </header>
  )
}
