'use client'

import { useEffect, useState } from 'react'
import { format, formatDistanceToNow } from 'date-fns'

interface RelativeTimeProps {
    date: Date | string
    className?: string
}

export function RelativeTime({ date, className }: RelativeTimeProps) {
    const resolvedTimestamp = typeof date === 'string' ? Date.parse(date) : date.getTime()
    const absoluteLabel = format(new Date(resolvedTimestamp), 'MMM d, yyyy')
    const [label, setLabel] = useState(absoluteLabel)

    useEffect(() => {
        setLabel(formatDistanceToNow(new Date(resolvedTimestamp), { addSuffix: true }))
    }, [resolvedTimestamp])

    return (
        <span className={className} title={absoluteLabel}>
            {label}
        </span>
    )
}
