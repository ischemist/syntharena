import { NextResponse } from 'next/server'

import prisma from '@/lib/db'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type DatabaseContract = {
    databaseSchemaVersion: number
    artifactSchemaVersion: string
    inventorySchemaVersion: string
    inventorySha256: string
    catalogSha256: string
    legacyUrlAliasesSha256: string | null
    producerTrustPolicySha256: string
    retrocastVersion: string
}

export async function GET() {
    const deploymentId = process.env.SYNTHARENA_DEPLOYMENT_SHA ?? 'unknown'

    try {
        const metadata = await prisma.$queryRaw<DatabaseContract[]>`
            SELECT
                "databaseSchemaVersion",
                "artifactSchemaVersion",
                "inventorySchemaVersion",
                "inventorySha256",
                "catalogSha256",
                "legacyUrlAliasesSha256",
                "producerTrustPolicySha256",
                "retrocastVersion"
            FROM "DatabaseMetadata"
            WHERE "id" = 'syntharena'
            LIMIT 1
        `

        return NextResponse.json(
            {
                deploymentId,
                database: metadata[0] ?? null,
            },
            { headers: { 'Cache-Control': 'no-store' } }
        )
    } catch (error) {
        console.error('deployment.database_contract_unavailable', error)
        return NextResponse.json(
            {
                deploymentId,
                database: null,
                code: 'deployment.database_contract_unavailable',
            },
            { status: 503, headers: { 'Cache-Control': 'no-store' } }
        )
    }
}
