import { AlertTriangle, BadgeCheck, Users } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card'

export type BadgeStyle = 'soft' | 'outline'

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
        title: 'Maintainer Verified',
        subtitle: 'Official Submission',
        description:
            'The SynthArena team has independently verified the hardware specifications, runtime environment, and configuration used for this benchmark run.',
        icon: BadgeCheck,
        colors: {
            soft: 'bg-indigo-50 text-indigo-700 border-transparent dark:bg-indigo-950/40 dark:text-indigo-400',
            outline: 'bg-transparent text-indigo-700 border-indigo-400 dark:text-indigo-400 dark:border-indigo-600',
        },
    },
    COMMUNITY_SUBMITTED: {
        label: 'Community',
        title: 'Community Submission',
        subtitle: 'Author-Reported Results',
        description:
            "Results submitted by the model's authors or community members. Scores have been computationally verified against the provided route data, but hardware and runtime details are self-reported.",
        icon: Users,
        colors: {
            soft: 'bg-amber-50 text-amber-700 border-transparent dark:bg-amber-950/40 dark:text-amber-400',
            outline: 'bg-transparent text-amber-700 border-amber-400 dark:text-amber-400 dark:border-amber-600',
        },
    },
} as const

const retrainingCaveat = {
    title: 'Training Protocol Caveat',
    description:
        "This result uses the author's official weights and was not retrained on the standardized corpus for this Reference benchmark. Its performance may not be directly comparable to retrained models",
}

export function SubmissionBadge({
    submissionType,
    isRetrained,
    size = 'md',
    badgeStyle = 'soft',
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
                    {showCaveat && (
                        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-800 dark:bg-amber-950/30">
                            <div className="mb-1 flex items-center gap-2">
                                <AlertTriangle className="size-3.5 text-amber-600 dark:text-amber-400" />
                                <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">
                                    {retrainingCaveat.title}
                                </p>
                            </div>
                            <p className="text-xs leading-relaxed text-amber-700 dark:text-amber-400">
                                {retrainingCaveat.description}
                            </p>
                        </div>
                    )}
                </div>
            </HoverCardContent>
        </HoverCard>
    )
}
