import * as React from 'react'
import { AlertTriangle, BadgeCheck, Users } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

export type BadgeStyle = 'default' | 'soft' | 'pill' | 'outline'

export interface SubmissionBadgeProps {
    submissionType: 'MAINTAINER_VERIFIED' | 'COMMUNITY_SUBMITTED'
    isRetrained?: boolean | null
    size?: 'sm' | 'md'
    badgeStyle?: BadgeStyle
    className?: string
}

const submissionConfig = {
    MAINTAINER_VERIFIED: {
        label: 'Verified',
        tooltip:
            'Verified by Maintainer: The SynthArena team attests to the hardware, runtime, and configuration used for this run.',
        icon: BadgeCheck,
        colors: {
            default:
                'bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-800',
            soft: 'bg-indigo-50 text-indigo-700 border-transparent dark:bg-indigo-950/40 dark:text-indigo-400',
            pill: 'bg-indigo-500 text-white border-transparent dark:bg-indigo-600',
            outline: 'bg-transparent text-indigo-700 border-indigo-400 dark:text-indigo-400 dark:border-indigo-600',
        },
    },
    COMMUNITY_SUBMITTED: {
        label: 'Community',
        tooltip:
            "Community Submission: Results submitted by the model's authors. Scores are computationally verified against the provided route data.",
        icon: Users,
        colors: {
            default:
                'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800',
            soft: 'bg-amber-50 text-amber-700 border-transparent dark:bg-amber-950/40 dark:text-amber-400',
            pill: 'bg-amber-500 text-white border-transparent dark:bg-amber-600',
            outline: 'bg-transparent text-amber-700 border-amber-400 dark:text-amber-400 dark:border-amber-600',
        },
    },
} as const

export function SubmissionBadge({
    submissionType,
    isRetrained,
    size = 'md',
    badgeStyle = 'default',
    className,
}: SubmissionBadgeProps) {
    const config = submissionConfig[submissionType]
    const Icon = config.icon
    const showCaveat = isRetrained === false
    const colorClass = config.colors[badgeStyle]

    const badgeContent = (
        <Badge
            variant="outline"
            className={cn(
                colorClass,
                badgeStyle === 'pill' && 'rounded-full',
                showCaveat && 'border-dashed',
                size === 'sm' ? 'px-1.5 py-0.5' : 'px-2 py-0.5',
                'relative',
                className
            )}
            aria-label={size === 'sm' ? `${config.label}${showCaveat ? ' (with retraining caveat)' : ''}` : undefined}
        >
            <Icon className={cn('shrink-0', size === 'sm' ? 'size-3' : 'size-3.5')} />
            {size === 'md' && <span>{config.label}</span>}
            {showCaveat && (
                <AlertTriangle
                    className={cn('shrink-0 text-amber-600 dark:text-amber-400', size === 'sm' ? 'size-2.5' : 'size-3')}
                />
            )}
        </Badge>
    )

    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>{badgeContent}</TooltipTrigger>
                <TooltipContent className="max-w-xs">
                    <p>{config.tooltip}</p>
                    {showCaveat && (
                        <p className="mt-2 font-medium text-amber-200">
                            <strong>Warning:</strong> This result uses a pre-trained model and does not adhere to the
                            standardized training protocol for this Reference benchmark. Its performance may not be
                            directly comparable to retrained models.
                        </p>
                    )}
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    )
}
