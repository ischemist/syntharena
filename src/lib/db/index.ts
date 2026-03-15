import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import { PrismaClient } from '@prisma/client'

// Environment variables are loaded by:
// - Next.js automatically in development/production
// - Vitest config for tests

const globalForPrisma = global as unknown as {
    prisma: PrismaClient
}

if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is not set')
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
