import * as React from 'react'
import { ExternalLink } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

export type BadgeStyle = 'soft' | 'outline'

export type VendorSource = 'MC' | 'LN' | 'EM' | 'SA' | 'CB'

export const VENDOR_NAMES: Record<VendorSource, string> = {
    MC: 'MilliporeSigma',
    LN: 'Labnetwork',
    EM: 'Enamine',
    SA: 'Sigma-Aldrich',
    CB: 'ChemBridge',
}

export interface VendorBadgeProps {
    source: VendorSource
    showFullName?: boolean
    size?: 'sm' | 'md'
    badgeStyle?: BadgeStyle
    className?: string
}

const vendorColors = {
    soft: 'bg-gray-50 text-gray-700 border-transparent dark:bg-gray-900/40 dark:text-gray-400',
    outline: 'bg-transparent text-gray-700 border-gray-400 dark:text-gray-400 dark:border-gray-600',
}

export function VendorBadge({
    source,
    showFullName = false,
    size = 'md',
    badgeStyle = 'soft',
    className,
}: VendorBadgeProps) {
    const displayText = showFullName ? VENDOR_NAMES[source] : source

    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <Badge
                        variant="outline"
                        className={cn(
                            vendorColors[badgeStyle],
                            size === 'sm' ? 'px-1.5 py-0.5' : 'px-2 py-0.5',
                            className
                        )}
                    >
                        {displayText}
                    </Badge>
                </TooltipTrigger>
                <TooltipContent>
                    <p>{VENDOR_NAMES[source]}</p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    )
}

/**
 * Price range color coding:
 * < $10/g: Green (affordable)
 * $10-100/g: Blue (moderate)
 * $100-1k/g: Amber (expensive)
 * $1k-10k/g: Orange (very expensive)
 * > $10k/g: Red (extremely expensive)
 */
function getPriceColors(ppg: number): { soft: string; outline: string } {
    if (ppg < 10) {
        return {
            soft: 'bg-green-50 text-green-700 border-transparent dark:bg-green-950/40 dark:text-green-400',
            outline: 'bg-transparent text-green-700 border-green-400 dark:text-green-400 dark:border-green-600',
        }
    } else if (ppg < 100) {
        return {
            soft: 'bg-blue-50 text-blue-700 border-transparent dark:bg-blue-950/40 dark:text-blue-400',
            outline: 'bg-transparent text-blue-700 border-blue-400 dark:text-blue-400 dark:border-blue-600',
        }
    } else if (ppg < 1000) {
        return {
            soft: 'bg-amber-50 text-amber-700 border-transparent dark:bg-amber-950/40 dark:text-amber-400',
            outline: 'bg-transparent text-amber-700 border-amber-400 dark:text-amber-400 dark:border-amber-600',
        }
    } else if (ppg < 10000) {
        return {
            soft: 'bg-orange-50 text-orange-700 border-transparent dark:bg-orange-950/40 dark:text-orange-400',
            outline: 'bg-transparent text-orange-700 border-orange-400 dark:text-orange-400 dark:border-orange-600',
        }
    } else {
        return {
            soft: 'bg-red-50 text-red-700 border-transparent dark:bg-red-950/40 dark:text-red-400',
            outline: 'bg-transparent text-red-700 border-red-400 dark:text-red-400 dark:border-red-600',
        }
    }
}

export function formatPrice(ppg: number): string {
    if (ppg < 1) {
        return `$${ppg.toFixed(2)}/g`
    } else if (ppg < 100) {
        return `$${ppg.toFixed(1)}/g`
    } else if (ppg < 1000) {
        return `$${ppg.toFixed(0)}/g`
    } else if (ppg < 10000) {
        return `$${(ppg / 1000).toFixed(1)}k/g`
    } else {
        return `$${Math.round(ppg / 1000)}k/g`
    }
}

export interface PriceBadgeProps {
    ppg: number
    size?: 'sm' | 'md'
    badgeStyle?: BadgeStyle
    className?: string
}

export function PriceBadge({ ppg, size = 'md', badgeStyle = 'soft', className }: PriceBadgeProps) {
    const priceColors = getPriceColors(ppg)
    const priceRange =
        ppg < 10
            ? 'Affordable (< $10/g)'
            : ppg < 100
              ? 'Moderate ($10-100/g)'
              : ppg < 1000
                ? 'Expensive ($100-1k/g)'
                : ppg < 10000
                  ? 'Very Expensive ($1k-10k/g)'
                  : 'Extremely Expensive (> $10k/g)'

    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <Badge
                        variant="outline"
                        className={cn(
                            priceColors[badgeStyle],
                            size === 'sm' ? 'px-1.5 py-0.5' : 'px-2 py-0.5',
                            className
                        )}
                    >
                        {formatPrice(ppg)}
                    </Badge>
                </TooltipTrigger>
                <TooltipContent>
                    <p>{priceRange}</p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    )
}

export interface BuyableMetadataStripProps {
    source: VendorSource
    ppg: number
    badgeStyle?: BadgeStyle
    className?: string
}

export function BuyableMetadataStrip({ source, ppg, badgeStyle = 'soft', className }: BuyableMetadataStripProps) {
    return (
        <div className={cn('flex items-center gap-1.5', className)}>
            <VendorBadge source={source} badgeStyle={badgeStyle} />
            <PriceBadge ppg={ppg} badgeStyle={badgeStyle} />
        </div>
    )
}

export interface BuyableInfoSectionProps {
    source: VendorSource
    ppg: number
    leadTime?: string | null
    link?: string | null
}

export function BuyableInfoSection({ source, ppg, leadTime, link }: BuyableInfoSectionProps) {
    return (
        <div className="space-y-2 border-t pt-3">
            <span className="text-muted-foreground text-xs font-semibold">Buyable Information</span>

            <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground text-xs">Vendor</span>
                    <VendorBadge source={source} showFullName badgeStyle="soft" />
                </div>

                <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground text-xs">Price</span>
                    <PriceBadge ppg={ppg} badgeStyle="soft" />
                </div>

                {leadTime && (
                    <div className="flex items-center justify-between gap-2">
                        <span className="text-muted-foreground text-xs">Lead Time</span>
                        <span className="text-foreground text-xs font-medium">{leadTime}</span>
                    </div>
                )}

                {link && (
                    <div className="pt-1">
                        <a
                            href={link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:text-primary/80 inline-flex items-center gap-1 text-xs font-medium underline-offset-2 hover:underline"
                        >
                            View on {VENDOR_NAMES[source]}
                            <ExternalLink className="h-3 w-3" />
                        </a>
                    </div>
                )}
            </div>
        </div>
    )
}
