import { NextResponse } from 'next/server'

import prisma from '@/lib/db'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const DATABASE_CHECK_TIMEOUT_MS = 1000

type HealthPayload = {
    ok: boolean
    service: 'syntharena'
    checks: {
        database: 'ok' | 'error'
    }
    timestamp: string
    code?: 'health.database_unavailable'
    message?: string
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    let timeout: NodeJS.Timeout

    const timeoutPromise = new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error('health.database_check_timeout')), timeoutMs)
    })

    return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeout))
}

export async function GET() {
    const payload: HealthPayload = {
        ok: true,
        service: 'syntharena',
        checks: {
            database: 'ok',
        },
        timestamp: new Date().toISOString(),
    }

    try {
        // Health probes are intentionally uncached so monitors see current app/database availability.
        await withTimeout(prisma.$queryRaw`SELECT 1`, DATABASE_CHECK_TIMEOUT_MS)
    } catch (error) {
        console.error('health.database_check_failed', error)
        payload.ok = false
        payload.checks.database = 'error'
        payload.code = 'health.database_unavailable'
        payload.message = 'Database unavailable.'
    }

    return NextResponse.json(payload, {
        status: payload.ok ? 200 : 503,
        headers: {
            'Cache-Control': 'no-store',
        },
    })
}
