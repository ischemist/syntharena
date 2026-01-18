import { Archive, BookOpen, Circle, ShoppingCart } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card'

export type BadgeStyle = 'soft' | 'outline'

export interface BenchmarkSeriesBadgeProps {
    series: 'MARKET' | 'REFERENCE' | 'LEGACY' | 'OTHER'
    size?: 'sm' | 'md'
    badgeStyle?: BadgeStyle
    className?: string
}

const seriesConfig = {
    MARKET: {
        label: 'Market',
        title: 'Market Series',
        subtitle: 'Chemist-Aligned Benchmark',
        description:
            'Evaluates practical utility by testing synthesis routes against commercially available building blocks. Results reflect real-world applicability for laboratory chemists.',
        icon: ShoppingCart,
        colors: {
            soft: 'bg-emerald-50 text-emerald-700 border-transparent dark:bg-emerald-950/40 dark:text-emerald-400',
            outline: 'bg-transparent text-emerald-700 border-emerald-400 dark:text-emerald-400 dark:border-emerald-600',
        },
    },
    REFERENCE: {
        label: 'Reference',
        title: 'Reference Series',
        subtitle: 'Developer-Aligned Benchmark',
        description:
            'Isolates algorithmic performance using standardized ground-truth building blocks. Ideal for comparing model architectures independent of stock availability.',
        icon: BookOpen,
        colors: {
            soft: 'bg-sky-50 text-sky-700 border-transparent dark:bg-sky-950/40 dark:text-sky-400',
            outline: 'bg-transparent text-sky-700 border-sky-400 dark:text-sky-400 dark:border-sky-600',
        },
    },
    LEGACY: {
        label: 'Legacy',
        title: 'Legacy Series',
        subtitle: 'Historical Benchmark',
        description:
            'Randomly sampled benchmark maintained for historical comparison. Not recommended for primary analysis of new models.',
        icon: Archive,
        colors: {
            soft: 'bg-stone-50 text-stone-600 border-transparent dark:bg-stone-900/40 dark:text-stone-400',
            outline: 'bg-transparent text-stone-600 border-stone-400 dark:text-stone-400 dark:border-stone-600',
        },
    },
    OTHER: {
        label: 'General',
        title: 'General Benchmark',
        subtitle: 'Uncategorized',
        description: 'A general benchmark that does not fall into the standard series categories.',
        icon: Circle,
        colors: {
            soft: 'bg-zinc-50 text-zinc-600 border-transparent dark:bg-zinc-900/40 dark:text-zinc-400',
            outline: 'bg-transparent text-zinc-600 border-zinc-400 dark:text-zinc-400 dark:border-zinc-600',
        },
    },
} as const

export function BenchmarkSeriesBadge({
    series,
    size = 'md',
    badgeStyle = 'soft',
    className,
}: BenchmarkSeriesBadgeProps) {
    const config = seriesConfig[series]
    const Icon = config.icon
    const colorClass = config.colors[badgeStyle]

    const badgeContent = (
        <Badge
            variant="outline"
            className={cn(colorClass, size === 'sm' ? 'px-1.5 py-0.5' : 'px-2 py-0.5', className)}
            aria-label={size === 'sm' ? config.label : undefined}
        >
            <Icon className={cn('shrink-0', size === 'sm' ? 'size-3' : 'size-3.5')} />
            {size === 'md' && <span>{config.label}</span>}
        </Badge>
    )

    return (
        <HoverCard openDelay={200} closeDelay={100}>
            <HoverCardTrigger asChild>{badgeContent}</HoverCardTrigger>
            <HoverCardContent className="w-80">
                <div className="space-y-3">
                    <div className="flex items-center gap-2">
                        <Icon className="size-4 shrink-0" />
                        <div>
                            <p className="text-sm font-semibold">{config.title}</p>
                            <p className="text-muted-foreground text-xs">{config.subtitle}</p>
                        </div>
                    </div>
                    <p className="text-muted-foreground text-sm leading-relaxed">{config.description}</p>
                </div>
            </HoverCardContent>
        </HoverCard>
    )
}
