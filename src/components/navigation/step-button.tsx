'use client'

import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

interface StepButtonProps {
    href: string | null
    direction: 'prev' | 'next'
    children: React.ReactNode
    className?: string
}

export function StepButton({ href, direction, children, className }: StepButtonProps) {
    const Icon = direction === 'prev' ? ChevronLeft : ChevronRight

    const content = (
        <Button variant="outline" size="sm" disabled={!href} className={cn('gap-1', className)}>
            {direction === 'prev' && <Icon className="size-4" />}
            {children}
            {direction === 'next' && <Icon className="size-4" />}
        </Button>
    )

    if (!href) {
        return content
    }

    return (
        <Link href={href} scroll={false} prefetch={true} className={!href ? 'pointer-events-none' : ''}>
            {content}
        </Link>
    )
}
