/**
 * demo.ts — Modo demostracion del sistema.
 *
 * UrbanReport se desarrollo como proyecto de titulo y su base de datos
 * (MySQL en Railway) dejo de estar en linea al terminar el proyecto.
 * Para que el sitio publicado siga siendo navegable, el modo demo reemplaza
 * las lecturas a la BD por datos de ejemplo y desactiva todo lo que escribe:
 * envio de reportes y acceso de funcionarios.
 *
 * El modo demo esta ACTIVO por defecto. Para correr el sistema completo con
 * una base de datos real, definir NEXT_PUBLIC_DEMO_MODE=false en .env.
 *
 * La variable es NEXT_PUBLIC_ para que el mismo valor este disponible tanto
 * en las API routes (servidor) como en los componentes cliente.
 *
 * Usado por: app/layout.tsx, app/acceso/page.tsx, app/api/reports, app/api/categorias
 */

export const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE !== 'false'

export const REPO_URL = 'https://github.com/ExOBrienX/UrbanReport'

// Mensaje que recibe el ciudadano al intentar enviar un reporte en modo demo
export const DEMO_MENSAJE_ENVIO =
  'Modo demostración: los reportes no se guardan porque el proyecto ya no tiene base de datos activa.'

// Categorias del sistema — mismos IDs y nombres que el seed de la BD
export const CATEGORIAS_DEMO = [
  { id: 1, nombre: 'Pavimento' },
  { id: 2, nombre: 'Veredas' },
  { id: 3, nombre: 'Señaletica' },
  { id: 4, nombre: 'Areas Verdes' },
  { id: 5, nombre: 'Residuos' },
  { id: 6, nombre: 'Mobiliario' },
]

type EstadoIncidencia = 'pendiente' | 'asignado' | 'en_curso' | 'completado'

interface SemillaReporte {
  categoria: number
  lat: number
  lon: number
  horas: number                       // antiguedad del reporte en horas
  estado: EstadoIncidencia | null     // null = aun en revision manual, sin incidencia
  descripcion: string
}

// Reportes de ejemplo repartidos por el area urbana de Talca.
// No corresponden a incidencias reales.
const SEMILLAS: SemillaReporte[] = [
  { categoria: 1, lat: -35.4268, lon: -71.6612, horas: 3,   estado: 'pendiente',  descripcion: 'Bache profundo en la calzada, los autos lo esquivan hacia la otra pista.' },
  { categoria: 2, lat: -35.4291, lon: -71.6558, horas: 26,  estado: 'asignado',   descripcion: 'Vereda levantada por raices, cuesta pasar con coche o silla de ruedas.' },
  { categoria: 3, lat: -35.4235, lon: -71.6649, horas: 50,  estado: 'en_curso',   descripcion: 'Disco Pare caido en la esquina, no se ve desde la calle.' },
  { categoria: 4, lat: -35.4312, lon: -71.6497, horas: 8,   estado: 'pendiente',  descripcion: 'Arbol con una rama quebrada a punto de caer sobre la vereda.' },
  { categoria: 5, lat: -35.4189, lon: -71.6583, horas: 72,  estado: 'pendiente',  descripcion: 'Microbasural en sitio eriazo, hay escombros y bolsas hace dias.' },
  { categoria: 6, lat: -35.4266, lon: -71.6551, horas: 30,  estado: 'completado', descripcion: 'Banca de la plaza rota, le faltan tablas del asiento.' },
  { categoria: 1, lat: -35.4342, lon: -71.6625, horas: 44,  estado: 'en_curso',   descripcion: 'Tapa de alcantarilla hundida justo en el cruce.' },
  { categoria: 5, lat: -35.4221, lon: -71.6478, horas: 12,  estado: 'asignado',   descripcion: 'Contenedor de basura volcado y desbordado.' },
  { categoria: 3, lat: -35.4275, lon: -71.6689, horas: 5,   estado: 'pendiente',  descripcion: 'Semaforo peatonal apagado desde ayer en la tarde.' },
  { categoria: 2, lat: -35.4302, lon: -71.6603, horas: 40,  estado: 'completado', descripcion: 'Baldosas sueltas frente al paradero de micros.' },
  { categoria: 4, lat: -35.4158, lon: -71.6661, horas: 1,   estado: null,         descripcion: 'Riego roto en el bandejon central, se esta inundando la calle.' },
  { categoria: 6, lat: -35.4371, lon: -71.6542, horas: 96,  estado: 'pendiente',  descripcion: 'Luminaria apagada en la esquina, la cuadra queda a oscuras.' },
  { categoria: 1, lat: -35.4248, lon: -71.6522, horas: 18,  estado: 'asignado',   descripcion: 'Grieta larga a lo ancho de la ciclovia.' },
  { categoria: 5, lat: -35.4329, lon: -71.6718, horas: 2,   estado: null,         descripcion: 'Ramas y restos de poda abandonados sobre la vereda.' },
]

const FOTOS: Record<number, string> = {
  1: '/demo/pavimento.svg',
  2: '/demo/veredas.svg',
  3: '/demo/senaletica.svg',
  4: '/demo/areas-verdes.svg',
  5: '/demo/residuos.svg',
  6: '/demo/mobiliario.svg',
}

/**
 * Devuelve los reportes de ejemplo con la misma forma que
 * ReporteService.obtenerActivos(), para que el mapa no distinga el origen.
 * Las fechas se calculan respecto a "ahora" para que la antiguedad
 * mostrada en los popups siempre sea coherente.
 */
export function getReportesDemo() {
  const ahora = Date.now()
  return SEMILLAS.map((s, i) => ({
    id: i + 1,
    latitud: s.lat.toFixed(7),   // Prisma serializa Decimal como string
    longitud: s.lon.toFixed(7),
    estado: s.estado ? 'pendiente' : 'pendiente_revision',
    descripcion: s.descripcion,
    foto_url: FOTOS[s.categoria],
    creado_en: new Date(ahora - s.horas * 60 * 60 * 1000).toISOString(),
    categoria_ia_id: s.categoria,
    resumen_ia: null,
    incidencia_id: s.estado ? i + 1 : null,
    confianza_ia: s.estado ? 0.9 : 0.55,
    incidencia: s.estado ? { estado: s.estado } : null,
  }))
}
