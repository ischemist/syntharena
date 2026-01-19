import * as React from 'react'

import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

export type BadgeStyle = 'soft' | 'outline'

export interface RouteLengthBadgeProps {
    length: number
    size?: 'sm' | 'md'
    badgeStyle?: BadgeStyle
    className?: string
}

const routeLengthColors = {
    soft: 'bg-slate-50 text-slate-600 border-transparent dark:bg-slate-900/40 dark:text-slate-400',
    outline: 'bg-transparent text-slate-600 border-slate-400 dark:text-slate-400 dark:border-slate-600',
}

export function RouteLengthBadge({ length, size = 'md', badgeStyle = 'soft', className }: RouteLengthBadgeProps) {
    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <Badge
                        variant="outline"
                        className={cn(
                            routeLengthColors[badgeStyle],
                            size === 'sm' ? 'px-1.5 py-0.5' : 'px-2 py-0.5',
                            className
                        )}
                    >
                        {length} {size === 'md' && 'steps'}
                    </Badge>
                </TooltipTrigger>
                <TooltipContent>
                    <p>Ground truth route: {length} steps</p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    )
}

export interface RouteTypeBadgeProps {
    isConvergent: boolean
    size?: 'sm' | 'md'
    badgeStyle?: BadgeStyle
    className?: string
}

const routeTypeColors = {
    convergent: {
        soft: 'bg-indigo-50 text-indigo-700 border-transparent dark:bg-indigo-950/40 dark:text-indigo-400',
        outline: 'bg-transparent text-indigo-700 border-indigo-400 dark:text-indigo-400 dark:border-indigo-600',
    },
    linear: {
        soft: 'bg-pink-50 text-pink-700 border-transparent dark:bg-pink-950/40 dark:text-pink-400',
        outline: 'bg-transparent text-pink-700 border-pink-400 dark:text-pink-400 dark:border-pink-600',
    },
}

export function RouteTypeBadge({ isConvergent, size = 'md', badgeStyle = 'soft', className }: RouteTypeBadgeProps) {
    const colorSet = isConvergent ? routeTypeColors.convergent : routeTypeColors.linear

    const label = isConvergent ? 'CNV' : 'LIN'
    const fullLabel = isConvergent ? 'Convergent' : 'Linear'
    const tooltip = isConvergent
        ? 'Convergent: route has reactions combining multiple intermediates'
        : 'Linear: sequential route with no branching'

    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <Badge
                        variant="outline"
                        className={cn(colorSet[badgeStyle], size === 'sm' ? 'px-1.5 py-0.5' : 'px-2 py-0.5', className)}
                    >
                        {size === 'sm' ? label : fullLabel}
                    </Badge>
                </TooltipTrigger>
                <TooltipContent>
                    <p>{tooltip}</p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    )
}
