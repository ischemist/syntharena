import Link from 'next/link'
import { ExternalLink, FileCode } from 'lucide-react'

import type { Algorithm, ModelFamily, ModelInstance } from '@/types'
import { formatVersion } from '@/lib/utils'
import { Button } from '@/components/ui/button'

interface ModelDetailHeaderProps {
    modelInstance: ModelInstance & { family: ModelFamily & { algorithm: Algorithm } }
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

            <p className="text-muted-foreground text-sm">
                Algorithm:{' '}
                <Link href={`/algorithms/${algorithm.slug}`} className="text-primary font-medium hover:underline">
                    {algorithm.name}
                </Link>
            </p>

            {/* External links to paper and code */}
            {(algorithm.paper || algorithm.codeUrl) && (
                <div className="flex flex-wrap gap-3">
                    {algorithm.paper && (
                        <Button variant="outline" size="sm" asChild>
                            <a href={algorithm.paper} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="mr-2 h-4 w-4" />
                                Paper
                            </a>
                        </Button>
                    )}
                    {algorithm.codeUrl && (
                        <Button variant="outline" size="sm" asChild>
                            <a href={algorithm.codeUrl} target="_blank" rel="noopener noreferrer">
                                <FileCode className="mr-2 h-4 w-4" />
                                Code
                            </a>
                        </Button>
                    )}
                </div>
            )}
        </div>
    )
}
