'use client'

import { CheckCircle, XCircle } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card'

interface StockTerminationBadgeProps {
    isTerminated: boolean
    stockName?: string
}

export type BadgeStyle = 'soft' | 'outline'

interface StockTerminationBadgeProps {
    isTerminated: boolean
    stockName?: string
    size?: 'sm' | 'md'
    badgeStyle?: BadgeStyle
    className?: string
}

const config = {
    terminated: {
        label: 'Stock-Terminated',
        icon: CheckCircle,
        description: 'All leaf nodes in this route are present in the stock.',
        colors: {
            soft: 'border-transparent bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400',
            outline: 'bg-transparent text-emerald-700 border-emerald-400 dark:text-emerald-400 dark:border-emerald-600',
        },
    },
    unsolved: {
        label: 'Unsolved',
        icon: XCircle,
        description: 'One or more leaf nodes in this route are not present in the stock.',
        colors: {
            soft: 'border-transparent bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400',
            outline: 'bg-transparent text-red-700 border-red-400 dark:text-red-400 dark:border-red-600',
        },
    },
}
export function StockTerminationBadge({
    isTerminated,
    stockName,
    size = 'md',
    badgeStyle = 'soft',
    className,
}: StockTerminationBadgeProps) {
    const badgeConfig = isTerminated ? config.terminated : config.unsolved
    const Icon = badgeConfig.icon
    const colorClass = badgeConfig.colors[badgeStyle]

    const badgeContent = (
        <Badge
            variant="outline"
            className={cn('gap-1.5', colorClass, size === 'sm' ? 'px-1.5 py-0.5 text-xs' : 'px-2 py-1', className)}
        >
            <Icon className={cn(size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5')} />
            <span>{badgeConfig.label}</span>
        </Badge>
    )
    if (!stockName) {
        return badgeContent
    }

    return (
        <HoverCard openDelay={200} closeDelay={100}>
            <HoverCardTrigger asChild>{badgeContent}</HoverCardTrigger>
            <HoverCardContent className="w-80">
                <div className="space-y-2">
                    <p className="text-sm font-semibold">{badgeConfig.label}</p>
                    <p className="text-muted-foreground text-sm">{badgeConfig.description}</p>
                    <div className="border-t pt-2">
                        <p className="text-muted-foreground text-xs">
                            Evaluated against: <span className="text-foreground font-medium">{stockName}</span>
                        </p>
                    </div>
                </div>
            </HoverCardContent>
        </HoverCard>
    )
}
