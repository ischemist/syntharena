import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import { PrismaClient } from '@prisma/client'
import { config } from 'dotenv'

// Load environment variables - check for test env first, then fall back to .env
// This allows tests to use .env.test instead of .env
const envFile = process.env.NODE_ENV === 'test' ? '.env.test' : '.env'
config({ path: envFile })

const globalForPrisma = global as unknown as {
    prisma: PrismaClient
}

const adapter = new PrismaBetterSqlite3({
    url: process.env.DATABASE_URL,
})
const prisma =
    globalForPrisma.prisma ||
    new PrismaClient({
        adapter,
    })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

export default prisma
