import Link from 'next/link'

import type { Algorithm, ModelFamily } from '@/types'

interface ModelFamilyDetailHeaderProps {
    family: ModelFamily & { algorithm: Algorithm }
}

export function ModelFamilyDetailHeader({ family }: ModelFamilyDetailHeaderProps) {
    return (
        <div className="space-y-4">
            <h1 className="text-3xl font-bold tracking-tight">{family.name}</h1>

            {family.description && <p className="text-muted-foreground text-lg">{family.description}</p>}

            <p className="text-muted-foreground text-sm">
                part of the{' '}
                <Link
                    href={`/algorithms/${family.algorithm.slug}`}
                    className="text-primary font-medium hover:underline"
                >
                    {family.algorithm.name}
                </Link>{' '}
                algorithm
            </p>
        </div>
    )
}
