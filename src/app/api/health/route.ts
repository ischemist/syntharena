import { NextResponse } from 'next/server'

import prisma from '@/lib/db'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

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
        await prisma.$queryRaw`SELECT 1`
    } catch (error) {
        console.error('health.database_check_failed', { error })
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
