import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

// La password inicial se lee del entorno para no dejar credenciales en el codigo
const SEED_PASSWORD = process.env.SEED_TECNICO_PASSWORD ?? ''
if (!SEED_PASSWORD) {
  console.error('Define SEED_TECNICO_PASSWORD antes de ejecutar este script')
  process.exit(1)
}

async function createTecnicoUser() {
  try {
    const existing = await prisma.usuario.findFirst({
      where: { rol: 'tecnico' }
    })

    if (existing) {
      console.log('Técnico ya existe:', existing.email)
      return
    }

    const hashedPassword = await bcrypt.hash(SEED_PASSWORD, 10)

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
    console.log('- Password: valor de SEED_TECNICO_PASSWORD')
    console.log('- Rol:', tecnico.rol)

  } catch (error) {
    console.error('Error creando técnico:', error)
  } finally {
    await prisma.$disconnect()
  }
}

createTecnicoUser()