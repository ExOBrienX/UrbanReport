/**
 * app/api/categorias/route.ts — Listado de categorias de incidencias activas.
 *
 * Devuelve las categorias configuradas en el sistema para poblar selectores
 * en el frontend. Se usa en BandejaRevision, GestionIncidencias, TareaUrgente
 * y GestionTecnicos para mostrar las categorias con sus IDs reales desde BD,
 * evitando el uso de arrays hardcodeados que pueden desincronizarse.
 *
 * Acceso publico — no requiere autenticacion.
 * Depende de: prisma
 */

import { NextResponse } from 'next/server'
import { prisma } from '../../lib/prisma'

// GET /api/categorias — retorna todas las categorias activas con id y nombre
export async function GET() {
  const categorias = await prisma.categoria.findMany({
    where: { activo: true },        // excluir categorias desactivadas
    select: { id: true, nombre: true }, // solo los campos necesarios para los selectores
    orderBy: { id: 'asc' }          // orden consistente en todos los componentes
  })
  return NextResponse.json({ categorias })
}