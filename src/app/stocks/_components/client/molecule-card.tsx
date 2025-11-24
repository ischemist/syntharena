'use client'

import { useState } from 'react'
import { Check, Copy } from 'lucide-react'

import type { Molecule } from '@/types'
import { SmileDrawerSvg } from '@/components/smile-drawer'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'

interface MoleculeCardProps {
    molecule: Molecule
}

/**
 * Client component that displays a single molecule card with structure visualization.
 * Includes copy-to-clipboard functionality for SMILES and InChiKey.
 */
export function MoleculeCard({ molecule }: MoleculeCardProps) {
    const [copiedField, setCopiedField] = useState<'smiles' | 'inchikey' | null>(null)

    const handleCopy = async (text: string, field: 'smiles' | 'inchikey') => {
        try {
            await navigator.clipboard.writeText(text)
            setCopiedField(field)
            setTimeout(() => setCopiedField(null), 2000)
        } catch (error) {
            console.error('Failed to copy:', error)
        }
    }

    return (
        <Card className="overflow-hidden">
            <CardHeader className="bg-muted/50 p-4">
                <div className="bg-background flex items-center justify-center rounded-md p-2">
                    <SmileDrawerSvg smilesStr={molecule.smiles} width={200} height={200} />
                </div>
            </CardHeader>
            <CardContent className="space-y-3 p-4">
                <div className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                        <Badge variant="outline" className="font-mono text-xs">
                            SMILES
                        </Badge>
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
                    <p className="text-muted-foreground font-mono text-sm break-all">{molecule.smiles}</p>
                </div>

                <div className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                        <Badge variant="outline" className="font-mono text-xs">
                            InChiKey
                        </Badge>
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
                    <p className="text-muted-foreground font-mono text-sm break-all">{molecule.inchikey}</p>
                </div>
            </CardContent>
        </Card>
    )
}
