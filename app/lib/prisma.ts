/**
 * prisma.ts — Instancia global de PrismaClient.
 *
 * En desarrollo, Next.js recarga los modulos en cada hot reload lo que
 * crearia una nueva conexion a la BD en cada cambio — agotando el pool
 * de conexiones de Railway rapidamente.
 *
 * La solucion es guardar la instancia en globalThis, que persiste entre
 * recargas del modulo en desarrollo. En produccion esto no aplica porque
 * el servidor no recarga modulos, por lo que se crea una instancia normal.
 *
 * Usado por: todos los servicios y routes que acceden a la BD.
 */

import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Reutilizar instancia existente en desarrollo, crear nueva en produccion
export const prisma = globalForPrisma.prisma ?? new PrismaClient()

// Guardar en globalThis solo en desarrollo para sobrevivir hot reloads
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma