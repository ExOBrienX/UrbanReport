import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function createTecnicos() {
  try {
    // Obtener categorías
    const categorias = await prisma.categoria.findMany()
    const cat = Object.fromEntries(categorias.map(c => [c.nombre, c.id]))
    console.log('Categorías encontradas:', Object.keys(cat))

    const tecnicos = [
      {
        nombre: 'Carlos Muñoz',
        rut: '33333333-3',
        email: 'tecnico.pavimento@urbanreport.cl',
        especialidades: ['Pavimento', 'Veredas']
      },
      {
        nombre: 'Pedro Soto',
        rut: '44444444-4',
        email: 'tecnico.verde@urbanreport.cl',
        especialidades: ['Areas Verdes', 'Residuos']
      },
      {
        nombre: 'Juan López',
        rut: '55555555-5',
        email: 'tecnico.señaletica@urbanreport.cl',
        especialidades: ['Senaletica', 'Mobiliario']
      }
    ]

    const hashedPassword = await bcrypt.hash('tecnico123', 10)

    for (const t of tecnicos) {
      // Verificar si ya existe
      const existing = await prisma.usuario.findUnique({ where: { email: t.email } })
      if (existing) {
        console.log(`Ya existe: ${t.email}`)
        continue
      }

      // Crear técnico
      const tecnico = await prisma.usuario.create({
        data: {
          nombre: t.nombre,
          rut: t.rut,
          email: t.email,
          password_hash: hashedPassword,
          rol: 'tecnico',
          activo: true
        }
      })

      // Asignar especialidades
      for (const especialidad of t.especialidades) {
        if (cat[especialidad]) {
          await prisma.especialidad.create({
            data: {
              usuario_id: tecnico.id,
              categoria_id: cat[especialidad]
            }
          })
        } else {
          console.warn(`⚠️ Categoría no encontrada: ${especialidad}`)
        }
      }

      console.log(`✅ ${t.nombre} creado con especialidades: ${t.especialidades.join(', ')}`)
    }

    console.log('\nTodos los técnicos listos. Credenciales: tecnico123')

  } catch (error) {
    console.error('Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

createTecnicos()