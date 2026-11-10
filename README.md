# UrbanReport

Plataforma web para que los vecinos de Talca reporten problemas urbanos (baches, veredas rotas, señalética caída, microbasurales) desde el celular, de forma anónima y en menos de un minuto. El municipio recibe cada reporte ya clasificado y priorizado, y lo gestiona hasta su resolución.

**Estado:** proyecto académico finalizado (2026). El sitio publicado funciona en [modo demostración](#modo-demostración).

**Demo:** https://urban-report.vercel.app

## Qué hace

**Ciudadano**
- Reporta sin crear cuenta: foto tomada desde la cámara, descripción corta y ubicación por GPS.
- Ve en un mapa las incidencias activas de la ciudad y su estado (pendiente, asignada, en curso, resuelta).

**Clasificación automática**
- Cada reporte pasa por un modelo de IA (Claude Haiku) que analiza la foto y la descripción, asigna una categoría y decide si se aprueba, se rechaza o pasa a revisión manual.
- El umbral de confianza es configurable por el administrador, sin tocar código.
- Los reportes cercanos de la misma categoría se agrupan en una sola incidencia usando la fórmula de Haversine, con un radio distinto por categoría.
- Cada incidencia recibe un puntaje de prioridad de 0 a 100 que ordena la cola de trabajo.

**Técnico municipal** (vista pensada para celular)
- Cola de tareas según sus especialidades, ordenada por prioridad.
- Acepta, inicia, informa atrasos y cierra tareas con una foto de evidencia.

**Administrador**
- Panel con indicadores: incidencias por estado, tasa de resolución, tiempos promedio por categoría y ranking de técnicos.
- Bandeja de revisión para los reportes que la IA no pudo decidir.
- Gestión de incidencias, tareas y técnicos.
- Informe mensual redactado con IA, descargable en PDF.

## Flujo de un reporte

1. El ciudadano envía foto, descripción y coordenadas.
2. El servidor valida los datos y que la ubicación esté dentro de Talca.
3. La foto se guarda en Cloudflare R2 y el reporte se registra en la base de datos.
4. La IA clasifica el reporte y devuelve categoría, nivel de confianza y un resumen técnico.
5. Si se aprueba, se crea una incidencia nueva o se suma a una cercana ya existente, y se recalcula su prioridad.
6. Se genera una tarea para los técnicos de esa especialidad.
7. El técnico la resuelve con evidencia fotográfica y el mapa se actualiza.

## Stack

| Área | Tecnología |
|---|---|
| Framework | Next.js 15 (App Router), React 19, TypeScript |
| Base de datos | MySQL con Prisma |
| Autenticación | NextAuth (credenciales, JWT, roles admin y técnico) |
| Mapas | Leaflet, react-leaflet, agrupación de marcadores, tiles y geocodificación de Jawg |
| IA | API de Anthropic (Claude Haiku) |
| Archivos | Cloudflare R2 (API compatible con S3) |
| Validación | Zod |
| Estilos | Tailwind CSS |
| Pruebas | Vitest |
| Despliegue | Vercel (aplicación), Railway (base de datos durante el desarrollo) |

## Estructura

```
app/
  page.tsx            Mapa ciudadano
  acceso/             Inicio de sesión de funcionarios
  admin/              Panel de administración
  tecnico/            Panel del técnico
  api/                Endpoints (reportes, tareas, administración, geocodificación)
  components/         Mapa, formulario de reporte y componentes compartidos
  lib/
    services/         Lógica de negocio (IA, incidencias, prioridad, Haversine, tareas)
    factories/        Respuestas HTTP uniformes
    demo.ts           Datos y configuración del modo demostración
prisma/               Esquema y migraciones
scripts/              Carga inicial de usuarios
```

La lógica de negocio vive en servicios independientes de los endpoints, lo que permite probarla por separado. Los algoritmos de prioridad y de agrupación tienen pruebas unitarias.

## Modo demostración

La base de datos del proyecto estuvo alojada en Railway durante el desarrollo y ya no está en línea. Para que el sitio siga siendo navegable, la aplicación arranca por defecto en modo demostración:

- El mapa muestra incidencias de ejemplo, que no corresponden a casos reales.
- El envío de reportes y el inicio de sesión de funcionarios están desactivados.
- Un aviso informa al visitante que está viendo una demo.

Para usar el sistema completo hay que definir `NEXT_PUBLIC_DEMO_MODE=false` y conectar una base de datos.

## Ejecutar en local

Requisitos: Node.js 20 o superior y pnpm. Para el sistema completo, además MySQL 8.

```bash
pnpm install
cp .env.example .env
pnpm dev
```

Con eso la aplicación abre en modo demostración en http://localhost:3000. Para que el mapa muestre las calles hace falta un token de Jawg en `NEXT_PUBLIC_JAWG_TOKEN`. Las variables de `.env.example` están comentadas una por una.

Para el sistema completo, con `NEXT_PUBLIC_DEMO_MODE=false` y `DATABASE_URL` configurada:

```bash
pnpm prisma migrate deploy
pnpm tsx scripts/create-admin.ts
pnpm tsx scripts/crear-tecnicos.ts
```

Los scripts de carga leen las contraseñas iniciales desde `SEED_ADMIN_PASSWORD` y `SEED_TECNICO_PASSWORD`. Las categorías de incidencias deben existir en la tabla `categorias` antes de crear técnicos.

Pruebas:

```bash
pnpm test
```

## Autores

Proyecto de título de Ingeniería en Informática, Instituto Profesional Santo Tomás.

- [ExOBrienX](https://github.com/ExOBrienX)
- [sanilus](https://github.com/sanilus)

## Derechos y uso

Este repositorio se publica con fines de portafolio y consulta. No se distribuye bajo una licencia de código abierto: no está autorizado su uso comercial ni su redistribución sin permiso de sus autores y, cuando corresponda, de la institución.
