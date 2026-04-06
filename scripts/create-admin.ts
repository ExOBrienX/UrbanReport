import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function createAdminUser() {
  try {
    // Verificar si ya existe un admin
    const existingAdmin = await prisma.usuario.findFirst({
      where: { rol: 'admin' }
    })

    if (existingAdmin) {
      console.log('Admin user already exists:', existingAdmin.email)
      return
    }

    // Crear usuario admin
    const hashedPassword = await bcrypt.hash('password123', 10)

    const adminUser = await prisma.usuario.create({
      data: {
        nombre: 'Administrador',
        rut: '11111111-1',
        email: 'admin@example.com',
        telefono: '+56987654321',
        password_hash: hashedPassword,
        rol: 'admin',
        activo: true
      }
    })

    console.log('Admin user created successfully:')
    console.log('- Email:', adminUser.email)
    console.log('- Password: password123')
    console.log('- Role:', adminUser.rol)

  } catch (error) {
    console.error('Error creating admin user:', error)
  } finally {
    await prisma.$disconnect()
  }
}

createAdminUser()