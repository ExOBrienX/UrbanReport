import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

// La password inicial se lee del entorno para no dejar credenciales en el codigo
const SEED_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? ''
if (!SEED_PASSWORD) {
  console.error('Define SEED_ADMIN_PASSWORD antes de ejecutar este script')
  process.exit(1)
}

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
    const hashedPassword = await bcrypt.hash(SEED_PASSWORD, 10)

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
    console.log('- Password: valor de SEED_ADMIN_PASSWORD')
    console.log('- Role:', adminUser.rol)

  } catch (error) {
    console.error('Error creating admin user:', error)
  } finally {
    await prisma.$disconnect()
  }
}

createAdminUser()