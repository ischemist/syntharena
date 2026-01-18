import * as React from 'react'
import { Archive, BookOpen, Circle, ShoppingCart } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

export type BadgeStyle = 'default' | 'soft' | 'pill' | 'outline'

export interface BenchmarkSeriesBadgeProps {
    series: 'MARKET' | 'REFERENCE' | 'LEGACY' | 'OTHER'
    size?: 'sm' | 'md'
    badgeStyle?: BadgeStyle
    className?: string
}

const seriesConfig = {
    MARKET: {
        label: 'Market',
        tooltip: 'Chemist-Aligned (Market Series): Evaluates practical utility using commercial stocks.',
        icon: ShoppingCart,
        colors: {
            default:
                'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800',
            soft: 'bg-emerald-50 text-emerald-700 border-transparent dark:bg-emerald-950/40 dark:text-emerald-400',
            pill: 'bg-emerald-500 text-white border-transparent dark:bg-emerald-600',
            outline: 'bg-transparent text-emerald-700 border-emerald-400 dark:text-emerald-400 dark:border-emerald-600',
        },
    },
    REFERENCE: {
        label: 'Reference',
        tooltip:
            'Developer-Aligned (Reference Series): Isolates algorithmic performance using standardized ground-truth stocks.',
        icon: BookOpen,
        colors: {
            default: 'bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-900/30 dark:text-sky-300 dark:border-sky-800',
            soft: 'bg-sky-50 text-sky-700 border-transparent dark:bg-sky-950/40 dark:text-sky-400',
            pill: 'bg-sky-500 text-white border-transparent dark:bg-sky-600',
            outline: 'bg-transparent text-sky-700 border-sky-400 dark:text-sky-400 dark:border-sky-600',
        },
    },
    LEGACY: {
        label: 'Legacy',
        tooltip: 'Legacy Set: Randomly sampled benchmark, not recommended for primary analysis.',
        icon: Archive,
        colors: {
            default:
                'bg-stone-100 text-stone-600 border-stone-200 dark:bg-stone-800/30 dark:text-stone-400 dark:border-stone-700',
            soft: 'bg-stone-50 text-stone-600 border-transparent dark:bg-stone-900/40 dark:text-stone-400',
            pill: 'bg-stone-500 text-white border-transparent dark:bg-stone-600',
            outline: 'bg-transparent text-stone-600 border-stone-400 dark:text-stone-400 dark:border-stone-600',
        },
    },
    OTHER: {
        label: 'General',
        tooltip: 'General Benchmark',
        icon: Circle,
        colors: {
            default:
                'bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800/30 dark:text-zinc-300 dark:border-zinc-700',
            soft: 'bg-zinc-50 text-zinc-600 border-transparent dark:bg-zinc-900/40 dark:text-zinc-400',
            pill: 'bg-zinc-500 text-white border-transparent dark:bg-zinc-600',
            outline: 'bg-transparent text-zinc-600 border-zinc-400 dark:text-zinc-400 dark:border-zinc-600',
        },
    },
} as const

export function BenchmarkSeriesBadge({
    series,
    size = 'md',
    badgeStyle = 'default',
    className,
}: BenchmarkSeriesBadgeProps) {
    const config = seriesConfig[series]
    const Icon = config.icon
    const colorClass = config.colors[badgeStyle]

    const badgeContent = (
        <Badge
            variant="outline"
            className={cn(
                colorClass,
                badgeStyle === 'pill' && 'rounded-full',
                size === 'sm' ? 'px-1.5 py-0.5' : 'px-2 py-0.5',
                className
            )}
            aria-label={size === 'sm' ? config.label : undefined}
        >
            <Icon className={cn('shrink-0', size === 'sm' ? 'size-3' : 'size-3.5')} />
            {size === 'md' && <span>{config.label}</span>}
        </Badge>
    )

    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>{badgeContent}</TooltipTrigger>
                <TooltipContent className="max-w-xs">
                    <p>{config.tooltip}</p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    )
}
