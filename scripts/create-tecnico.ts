import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function createTecnicoUser() {
  try {
    const existing = await prisma.usuario.findFirst({
      where: { rol: 'tecnico' }
    })

    if (existing) {
      console.log('Técnico ya existe:', existing.email)
      return
    }

    const hashedPassword = await bcrypt.hash('tecnico123', 10)

    const tecnico = await prisma.usuario.create({
      data: {
        nombre: 'Técnico Test',
        rut: '22222222-2',
        email: 'tecnico@urbanreport.cl',
        telefono: '+56912345678',
        password_hash: hashedPassword,
        rol: 'tecnico',
        activo: true
      }
    })

    console.log('✅ Técnico creado:')
    console.log('- Email:', tecnico.email)
    console.log('- Password: [configurada en el script]')
    console.log('- Rol:', tecnico.rol)

  } catch (error) {
    console.error('Error creando técnico:', error)
  } finally {
    await prisma.$disconnect()
  }
}

createTecnicoUser()