import Link from 'next/link'
import { ArrowLeft, ExternalLink, FileCode } from 'lucide-react'

import type { Algorithm } from '@/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

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
            {/* Back navigation */}
            <Link
                href="/algorithms"
                className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
            >
                <ArrowLeft className="h-4 w-4" />
                Back to algorithms
            </Link>

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

            {/* Bibtex citation - always visible */}
            {algorithm.bibtex && (
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Citation</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <pre className="bg-muted overflow-x-auto rounded-md p-4 text-xs">
                            <code>{algorithm.bibtex}</code>
                        </pre>
                    </CardContent>
                </Card>
            )}
        </div>
    )
}
