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
import { Skeleton } from '@/components/ui/skeleton'

interface MoleculeCardProps {
    molecule: MoleculeWithStocks
    index?: number // Add this prop
}

export function MoleculeCard({ molecule, index = 0 }: MoleculeCardProps) {
    const [copiedField, setCopiedField] = useState<'smiles' | 'inchikey' | null>(null)

    // TIME SLICING:
    // If index < 12 (likely "above the fold"), render immediately.
    // Otherwise, delay rendering to free up the main thread.
    const [isReady, setIsReady] = useState(index < 12)

    useEffect(() => {
        if (isReady) return

        // Stagger calculation: 30ms per item
        // Item 50 waits 1.5 seconds. The browser remains interactive.
        const delay = (index - 12) * 30
        const timer = setTimeout(() => setIsReady(true), delay)

        return () => clearTimeout(timer)
    }, [index, isReady])

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
        const timer = setTimeout(() => setCopiedField(null), 2000)
        return () => clearTimeout(timer)
    }, [copiedField])

    return (
        <Card className="group relative aspect-square overflow-hidden transition-all hover:shadow-lg">
            <div className="flex h-full w-full items-center justify-center p-4">
                {isReady ? (
                    <div className="animate-in fade-in duration-500">
                        <SmileDrawerSvg smilesStr={molecule.smiles} width={100} height={100} />
                    </div>
                ) : (
                    // While waiting in the queue, show a lighter skeleton
                    <Skeleton className="h-[200px] w-[200px] rounded-full opacity-10" />
                )}
            </div>

            {/*
               Only render the interactive overlay if ready.
               Prevents 50 HoverCards from hydrating at once.
            */}
            {isReady && (
                <HoverCard>
                    <HoverCardTrigger asChild>
                        <button className="absolute top-2 right-2 opacity-0 transition-opacity group-hover:opacity-100">
                            <Info className="text-muted-foreground h-4 w-4" />
                        </button>
                    </HoverCardTrigger>
                    <HoverCardContent className="w-80" side="left">
                        {/* Content stays the same... */}
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
                                <p className="text-foreground line-clamp-3 font-mono text-xs break-all hover:line-clamp-none">
                                    {molecule.smiles}
                                </p>
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
                                                <Badge
                                                    variant="secondary"
                                                    className="hover:bg-secondary/80 cursor-pointer"
                                                >
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
            )}
        </Card>
    )
}
