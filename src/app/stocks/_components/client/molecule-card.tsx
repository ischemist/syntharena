'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Check, Copy, Info } from 'lucide-react'

import type { MoleculeWithStocks } from '@/types'
import { SmileDrawerSvg } from '@/components/smile-drawer'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card'

interface MoleculeCardProps {
    molecule: MoleculeWithStocks
}

/**
 * Client component that displays a single molecule card with structure visualization.
 * Shows SMILES and InChiKey in a hover card with copy-to-clipboard functionality.
 */
export function MoleculeCard({ molecule }: MoleculeCardProps) {
    const [copiedField, setCopiedField] = useState<'smiles' | 'inchikey' | null>(null)

    const handleCopy = async (text: string, field: 'smiles' | 'inchikey') => {
        try {
            await navigator.clipboard.writeText(text)
            setCopiedField(field)
        } catch (error) {
            console.error('Failed to copy:', error)
        }
    }

    useEffect(() => {
        if (!copiedField) return

        const timer = setTimeout(() => {
            setCopiedField(null)
        }, 2000)

        return () => clearTimeout(timer)
    }, [copiedField])

    return (
        <Card className="group relative aspect-square overflow-hidden transition-all hover:shadow-lg">
            <div className="flex h-full w-full items-center justify-center p-4">
                <SmileDrawerSvg smilesStr={molecule.smiles} width={250} height={250} />
            </div>
            <HoverCard>
                <HoverCardTrigger asChild>
                    <button className="absolute top-2 right-2 opacity-0 transition-opacity group-hover:opacity-100">
                        <div className="bg-background/90 hover:bg-background rounded-full p-1.5 backdrop-blur-sm">
                            <Info className="text-muted-foreground h-4 w-4" />
                        </div>
                    </button>
                </HoverCardTrigger>
                <HoverCardContent className="w-80" side="left">
                    <div className="space-y-3">
                        <div className="space-y-1">
                            <div className="flex items-center justify-between gap-2">
                                <span className="text-muted-foreground text-xs font-semibold">SMILES</span>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-6 p-0"
                                    onClick={() => handleCopy(molecule.smiles, 'smiles')}
                                >
                                    {copiedField === 'smiles' ? (
                                        <Check className="h-3 w-3 text-green-500" />
                                    ) : (
                                        <Copy className="h-3 w-3" />
                                    )}
                                </Button>
                            </div>
                            <p className="text-foreground font-mono text-xs break-all">{molecule.smiles}</p>
                        </div>

                        <div className="space-y-1">
                            <div className="flex items-center justify-between gap-2">
                                <span className="text-muted-foreground text-xs font-semibold">InChiKey</span>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-6 p-0"
                                    onClick={() => handleCopy(molecule.inchikey, 'inchikey')}
                                >
                                    {copiedField === 'inchikey' ? (
                                        <Check className="h-3 w-3 text-green-500" />
                                    ) : (
                                        <Copy className="h-3 w-3" />
                                    )}
                                </Button>
                            </div>
                            <p className="text-foreground font-mono text-xs break-all">{molecule.inchikey}</p>
                        </div>

                        {molecule.stocks.length > 0 && (
                            <div className="space-y-2 border-t pt-3">
                                <span className="text-muted-foreground text-xs font-semibold">
                                    Found in {molecule.stocks.length} stock{molecule.stocks.length !== 1 ? 's' : ''}
                                </span>
                                <div className="flex flex-wrap gap-1">
                                    {molecule.stocks.map((stock) => (
                                        <Link key={stock.id} href={`/stocks/${stock.id}`}>
                                            <Badge variant="secondary" className="hover:bg-secondary/80 cursor-pointer">
                                                {stock.name}
                                            </Badge>
                                        </Link>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </HoverCardContent>
            </HoverCard>
        </Card>
    )
}
