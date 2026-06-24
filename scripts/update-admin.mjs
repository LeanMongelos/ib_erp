import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { config } from 'dotenv'

config()

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })

await prisma.usuario.update({
  where: { email: 'admin@ib.com' },
  data:  { nombre: 'Leandro Mongelos' },
})

console.log('✅ Usuario actualizado')
await prisma.$disconnect()
