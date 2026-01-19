import { AlertCircle, AlertTriangle } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card'

export type BadgeStyle = 'soft' | 'outline'

export type ReliabilityCode = 'LOW_N' | 'EXTREME_P' | 'OK'

export interface ReliabilityFlag {
    code: ReliabilityCode
    message: string
}

export interface ReliabilityBadgeProps {
    reliability: ReliabilityFlag
    size?: 'sm' | 'md'
    badgeStyle?: BadgeStyle
    className?: string
}

const reliabilityConfig = {
    LOW_N: {
        label: 'Low Sample',
        shortLabel: 'Low N',
        icon: AlertTriangle,
        title: 'Low Sample Size Warning',
        description:
            'This metric was calculated from a small number of data points, which may reduce statistical confidence. Results should be interpreted with caution.',
        colors: {
            soft: 'bg-amber-50 text-amber-700 border-transparent dark:bg-amber-950/40 dark:text-amber-400',
            outline: 'bg-transparent text-amber-700 border-amber-400 dark:text-amber-400 dark:border-amber-600',
        },
    },
    EXTREME_P: {
        label: 'Boundary Value',
        shortLabel: 'Extreme',
        icon: AlertCircle,
        title: 'Extreme Value Warning',
        description:
            'This value falls at or near the boundary of the expected distribution, which may indicate an outlier or edge case requiring additional verification.',
        colors: {
            soft: 'bg-blue-50 text-blue-700 border-transparent dark:bg-blue-950/40 dark:text-blue-400',
            outline: 'bg-transparent text-blue-700 border-blue-400 dark:text-blue-400 dark:border-blue-600',
        },
    },
} as const

export function ReliabilityBadge({ reliability, size = 'md', badgeStyle = 'soft', className }: ReliabilityBadgeProps) {
    // Don't render anything for OK status
    if (reliability.code === 'OK') {
        return null
    }

    const config = reliabilityConfig[reliability.code]
    const Icon = config.icon
    const colorClass = config.colors[badgeStyle]

    const displayLabel = size === 'sm' ? config.shortLabel : config.label

    const badgeContent = (
        <Badge
            variant="outline"
            className={cn(colorClass, size === 'sm' ? 'px-1.5 py-0.5' : 'px-2 py-0.5', className)}
            aria-label={config.label}
        >
            <Icon className={cn('shrink-0', size === 'sm' ? 'size-3' : 'size-3.5')} />
            {size === 'md' && <span>{displayLabel}</span>}
        </Badge>
    )

    return (
        <HoverCard openDelay={200} closeDelay={100}>
            <HoverCardTrigger asChild>{badgeContent}</HoverCardTrigger>
            <HoverCardContent className="w-80">
                <div className="space-y-3">
                    <div className="flex items-center gap-2">
                        <Icon className="size-4 shrink-0" />
                        <p className="text-sm font-semibold">{config.title}</p>
                    </div>
                    <p className="text-muted-foreground text-sm leading-relaxed">{config.description}</p>
                    {reliability.message && (
                        <div className="bg-muted/50 rounded-md px-3 py-2">
                            <p className="text-muted-foreground text-xs">
                                <span className="text-foreground font-medium">Details:</span> {reliability.message}
                            </p>
                        </div>
                    )}
                </div>
            </HoverCardContent>
        </HoverCard>
    )
}
