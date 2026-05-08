'use client'

import { useEffect, useState } from 'react'
import { format, formatDistanceToNow } from 'date-fns'

interface RelativeTimeProps {
    date: Date | string
    className?: string
}

export function RelativeTime({ date, className }: RelativeTimeProps) {
    const resolvedDate = new Date(date)
    const absoluteLabel = format(resolvedDate, 'MMM d, yyyy')
    const [label, setLabel] = useState(absoluteLabel)

    useEffect(() => {
        setLabel(formatDistanceToNow(resolvedDate, { addSuffix: true }))
    }, [resolvedDate])

    return (
        <span className={className} title={absoluteLabel}>
            {label}
        </span>
    )
}
