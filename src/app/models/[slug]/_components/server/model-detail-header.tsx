import Link from 'next/link'

import type { Algorithm, ModelInstance } from '@/types'

interface ModelDetailHeaderProps {
    modelInstance: ModelInstance & { algorithm: Algorithm }
}

/**
 * Formats a semantic version from its components.
 */
function formatVersion(instance: ModelInstance): string {
    const base = `v${instance.versionMajor}.${instance.versionMinor}.${instance.versionPatch}`
    return instance.versionPrerelease ? `${base}-${instance.versionPrerelease}` : base
}

/**
 * Server component displaying model instance metadata including
 * name, version, description, and link back to parent algorithm.
 */
export function ModelDetailHeader({ modelInstance }: ModelDetailHeaderProps) {
    const algorithm = modelInstance.algorithm

    return (
        <div className="space-y-4">
            {/* Title with version badge */}
            <div className="flex items-center gap-3">
                <h1 className="text-3xl font-bold tracking-tight">{modelInstance.name}</h1>
                <code className="bg-muted rounded px-2 py-1 text-sm font-medium">{formatVersion(modelInstance)}</code>
            </div>

            {/* Description */}
            {modelInstance.description && <p className="text-muted-foreground text-lg">{modelInstance.description}</p>}

            {/* Algorithm reference */}
            <p className="text-muted-foreground text-sm">
                Algorithm:{' '}
                <Link href={`/algorithms/${algorithm.slug}`} className="font-medium hover:underline">
                    {algorithm.name}
                </Link>
            </p>
        </div>
    )
}
