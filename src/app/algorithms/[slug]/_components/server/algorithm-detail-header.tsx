import { ExternalLink, FileCode } from 'lucide-react'

import type { Algorithm } from '@/types'
import { Button } from '@/components/ui/button'

interface AlgorithmDetailHeaderProps {
    algorithm: Algorithm
}

/**
 * Server component displaying algorithm metadata including
 * name, description, paper link, code link, and bibtex citation.
 */
export function AlgorithmDetailHeader({ algorithm }: AlgorithmDetailHeaderProps) {
    return (
        <div className="space-y-6">
            {/* Title and description */}
            <div className="space-y-2">
                <h1 className="text-3xl font-bold tracking-tight">{algorithm.name}</h1>
                {algorithm.description && <p className="text-muted-foreground text-lg">{algorithm.description}</p>}
            </div>

            {/* External links */}
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
