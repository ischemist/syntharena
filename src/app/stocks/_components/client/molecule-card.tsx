'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Check, Copy, Info } from 'lucide-react'

import type { MoleculeWithStocks } from '@/types'
import { BuyableInfoSection, BuyableMetadataStrip } from '@/components/buyable-badges'
import { SmileDrawerSvg } from '@/components/smile-drawer'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card'
import { Skeleton } from '@/components/ui/skeleton'

interface MoleculeCardProps {
    molecule: MoleculeWithStocks
    index?: number
}

// reduced delay - rely on content-visibility for layout perf
const ABOVE_THE_FOLD = 12
const RENDER_DELAY_MS = 10

export function MoleculeCard({ molecule, index = 0 }: MoleculeCardProps) {
    const [copiedField, setCopiedField] = useState<'smiles' | 'inchikey' | null>(null)
    const [isReady, setIsReady] = useState(index < ABOVE_THE_FOLD)

    useEffect(() => {
        if (isReady) return
        const timer = setTimeout(() => setIsReady(true), (index - ABOVE_THE_FOLD) * RENDER_DELAY_MS)
        return () => clearTimeout(timer)
    }, [index, isReady])

    const handleCopy = async (text: string, field: 'smiles' | 'inchikey') => {
        await navigator.clipboard.writeText(text)
        setCopiedField(field)
        setTimeout(() => setCopiedField(null), 2000)
    }

    const hasBuyableData = molecule.stockItem?.source != null && molecule.stockItem?.ppg != null

    return (
        // OPTIMIZATION: content-visibility: auto skips rendering work for off-screen cards
        <Card
            className="group relative aspect-4/5 overflow-hidden transition-all hover:shadow-lg"
            style={{ contentVisibility: 'auto', containIntrinsicSize: '200px 250px' }}
        >
            <div className="absolute inset-x-0 top-4 bottom-12 flex items-center justify-center p-4">
                {isReady ? (
                    <div className="animate-in fade-in duration-500">
                        <SmileDrawerSvg smilesStr={molecule.smiles} width={80} height={80} />
                    </div>
                ) : (
                    <Skeleton className="h-[200px] w-[200px] rounded-full opacity-10" />
                )}
            </div>

            {isReady && hasBuyableData && molecule.stockItem && (
                <div className="absolute right-2 bottom-2 left-2 flex items-center justify-center">
                    <div className="rounded-lg px-2 py-1.5 backdrop-blur-sm">
                        <BuyableMetadataStrip
                            source={molecule.stockItem.source!}
                            ppg={molecule.stockItem.ppg!}
                            variant="soft"
                        />
                    </div>
                </div>
            )}

            {isReady && (
                <HoverCard>
                    <HoverCardTrigger asChild>
                        <button className="absolute top-2 right-2 opacity-0 transition-opacity group-hover:opacity-100">
                            <Info className="text-muted-foreground h-4 w-4" />
                        </button>
                    </HoverCardTrigger>
                    <HoverCardContent className="w-80" side="left">
                        {/* ... keep content same ... */}
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

                            {hasBuyableData && molecule.stockItem && (
                                <BuyableInfoSection
                                    source={molecule.stockItem.source!}
                                    ppg={molecule.stockItem.ppg!}
                                    leadTime={molecule.stockItem.leadTime}
                                    link={molecule.stockItem.link}
                                />
                            )}

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
