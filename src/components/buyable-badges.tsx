'use client'

import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { ExternalLink } from 'lucide-react'

import type { VendorSource } from '@/types'
import { VENDOR_NAMES } from '@/types'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

/**
 * Translucent badge variants for buyable metadata display.
 * Designed to be subtle and compact, following route-badges pattern.
 */
const buyableBadgeVariants = cva(
    'inline-flex items-center justify-center rounded-md px-1.5 py-0.5 text-xs font-medium whitespace-nowrap',
    {
        variants: {
            /**
             * Style variants:
             * - ghost: translucent bg only, no border (most subtle)
             * - soft: translucent bg with matching border (balanced)
             * - outline: border only, no fill (minimal)
             */
            variant: {
                ghost: 'border-transparent',
                soft: 'border',
                outline: 'border bg-transparent',
            },
        },
        defaultVariants: {
            variant: 'ghost',
        },
    }
)

type BuyableBadgeVariantProps = VariantProps<typeof buyableBadgeVariants>

interface BuyableBadgeProps extends Omit<React.HTMLAttributes<HTMLSpanElement>, 'color'>, BuyableBadgeVariantProps {}

function BuyableBadge({ className, variant, ...props }: BuyableBadgeProps) {
    return <span className={cn(buyableBadgeVariants({ variant }), className)} {...props} />
}

/**
 * Vendor color scheme mapping - uses neutral grey for all vendors to reduce visual noise
 * All vendors use the same grey color scheme for consistency
 */
const VENDOR_COLORS: Record<VendorSource, string> = {
    MC: 'bg-gray-500/15 text-gray-700 dark:text-gray-300 border-gray-500/30',
    LN: 'bg-gray-500/15 text-gray-700 dark:text-gray-300 border-gray-500/30',
    EM: 'bg-gray-500/15 text-gray-700 dark:text-gray-300 border-gray-500/30',
    SA: 'bg-gray-500/15 text-gray-700 dark:text-gray-300 border-gray-500/30',
    CB: 'bg-gray-500/15 text-gray-700 dark:text-gray-300 border-gray-500/30',
}

/**
 * Displays vendor source badge with color coding
 */
interface VendorBadgeProps extends Omit<BuyableBadgeProps, 'children'> {
    source: VendorSource
    showFullName?: boolean
}

function VendorBadge({ source, showFullName = false, variant = 'ghost', className, ...props }: VendorBadgeProps) {
    const displayText = showFullName ? VENDOR_NAMES[source] : source

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <BuyableBadge variant={variant} className={cn(VENDOR_COLORS[source], className)} {...props}>
                    {displayText}
                </BuyableBadge>
            </TooltipTrigger>
            <TooltipContent>
                <p>{VENDOR_NAMES[source]}</p>
            </TooltipContent>
        </Tooltip>
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
function getPriceColorClass(ppg: number): string {
    if (ppg < 10) {
        return 'bg-green-500/15 text-green-700 dark:text-green-300 border-green-500/30'
    } else if (ppg < 100) {
        return 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30'
    } else if (ppg < 1000) {
        return 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30'
    } else if (ppg < 10000) {
        return 'bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30'
    } else {
        return 'bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30'
    }
}

/**
 * Format price for display - adds appropriate precision and shortens large numbers
 */
function formatPrice(ppg: number): string {
    if (ppg < 1) {
        return `$${ppg.toFixed(2)}/g`
    } else if (ppg < 100) {
        return `$${ppg.toFixed(1)}/g`
    } else if (ppg < 1000) {
        return `$${ppg.toFixed(0)}/g`
    } else if (ppg < 10000) {
        // Format as X.Xk/g (e.g., 3400 -> 3.4k/g)
        return `$${(ppg / 1000).toFixed(1)}k/g`
    } else {
        // Format as XXk/g or XXXk/g (e.g., 15000 -> 15k/g, 123000 -> 123k/g)
        return `$${Math.round(ppg / 1000)}k/g`
    }
}

/**
 * Displays price per gram badge with color coding
 */
interface PriceBadgeProps extends Omit<BuyableBadgeProps, 'children'> {
    ppg: number
}

function PriceBadge({ ppg, variant = 'ghost', className, ...props }: PriceBadgeProps) {
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
        <Tooltip>
            <TooltipTrigger asChild>
                <BuyableBadge variant={variant} className={cn(getPriceColorClass(ppg), className)} {...props}>
                    {formatPrice(ppg)}
                </BuyableBadge>
            </TooltipTrigger>
            <TooltipContent>
                <p>{priceRange}</p>
            </TooltipContent>
        </Tooltip>
    )
}

/**
 * Compact display of vendor + price for card overlays
 */
interface BuyableMetadataStripProps {
    source: VendorSource
    ppg: number
    variant?: 'ghost' | 'soft' | 'outline'
    className?: string
}

function BuyableMetadataStrip({ source, ppg, variant = 'ghost', className }: BuyableMetadataStripProps) {
    return (
        <div className={cn('flex items-center gap-1.5', className)}>
            <VendorBadge source={source} variant={variant} />
            <PriceBadge ppg={ppg} variant={variant} />
        </div>
    )
}

/**
 * Detailed buyable information section for hover cards
 */
interface BuyableInfoSectionProps {
    source: VendorSource
    ppg: number
    leadTime?: string | null
    link?: string | null
}

function BuyableInfoSection({ source, ppg, leadTime, link }: BuyableInfoSectionProps) {
    return (
        <div className="space-y-2 border-t pt-3">
            <span className="text-muted-foreground text-xs font-semibold">Buyable Information</span>

            <div className="space-y-1.5">
                {/* Vendor */}
                <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground text-xs">Vendor</span>
                    <VendorBadge source={source} showFullName variant="soft" />
                </div>

                {/* Price */}
                <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground text-xs">Price</span>
                    <PriceBadge ppg={ppg} variant="soft" />
                </div>

                {/* Lead Time (optional) */}
                {leadTime && (
                    <div className="flex items-center justify-between gap-2">
                        <span className="text-muted-foreground text-xs">Lead Time</span>
                        <span className="text-foreground text-xs font-medium">{leadTime}</span>
                    </div>
                )}

                {/* Purchase Link (optional) */}
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

export {
    BuyableBadge,
    buyableBadgeVariants,
    VendorBadge,
    PriceBadge,
    BuyableMetadataStrip,
    BuyableInfoSection,
    formatPrice,
}
export type { VendorBadgeProps, PriceBadgeProps, BuyableMetadataStripProps, BuyableInfoSectionProps }
