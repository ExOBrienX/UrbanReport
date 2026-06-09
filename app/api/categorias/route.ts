// app/api/categorias/route.ts
//obtenemos las categorias activas para mostrarlas en en el dahsboard y filtrados
import { NextResponse } from 'next/server'
import { prisma } from '../../lib/prisma'

export async function GET() {
  const categorias = await prisma.categoria.findMany({
    where: { activo: true },
    select: { id: true, nombre: true }
  })
  return NextResponse.json({ categorias })
}