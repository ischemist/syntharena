import Link from 'next/link'

import type { Algorithm, ModelFamily, ModelInstance } from '@/types'

interface ModelDetailHeaderProps {
    modelInstance: ModelInstance & { family: ModelFamily & { algorithm: Algorithm } }
}

function formatVersion(instance: ModelInstance): string {
    const base = `v${instance.versionMajor}.${instance.versionMinor}.${instance.versionPatch}`
    return instance.versionPrerelease ? `${base}-${instance.versionPrerelease}` : base
}

export function ModelDetailHeader({ modelInstance }: ModelDetailHeaderProps) {
    const { family } = modelInstance
    const { algorithm } = family

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-3">
                {/* use family name for the title */}
                <h1 className="text-3xl font-bold tracking-tight">{family.name}</h1>
                <code className="bg-muted rounded px-2 py-1 text-sm font-medium">{formatVersion(modelInstance)}</code>
            </div>

            {modelInstance.description && <p className="text-muted-foreground text-lg">{modelInstance.description}</p>}

            <div className="flex flex-col gap-1">
                <p className="text-muted-foreground text-sm">
                    Algorithm:{' '}
                    <Link href={`/algorithms/${algorithm.slug}`} className="text-primary font-medium hover:underline">
                        {algorithm.name}
                    </Link>
                </p>
                <p className="text-muted-foreground text-sm">
                    Model Family:{' '}
                    <Link href={`/model-families/${family.slug}`} className="text-primary font-medium hover:underline">
                        {family.name}
                    </Link>
                </p>
            </div>
        </div>
    )
}
