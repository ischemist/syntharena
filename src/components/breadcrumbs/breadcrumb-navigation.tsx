'use client'

import { Fragment, useEffect, useMemo, useState } from 'react'
import { useSelectedLayoutSegments } from 'next/navigation'

import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'

import { resolveSegmentNames } from './breadcrumb-resolver.service'
import { isDynamicSegment, STATIC_SEGMENT_LABELS, type BreadcrumbSegment } from './types'

/**
 * Client component that renders breadcrumb navigation based on current URL path.
 * Uses Next.js's useSelectedLayoutSegments hook to read URL segments and
 * fetches display names for dynamic segments (IDs) via server action.
 *
 * This component is placed in the root layout header for global navigation.
 */
export function BreadcrumbNavigation() {
    const segments = useSelectedLayoutSegments()
    const [displayNames, setDisplayNames] = useState<Record<string, string>>({})

    // Filter out route groups like (auth), (dashboard) - they start with parentheses
    const cleanSegments = useMemo(() => segments.filter((s) => !s.startsWith('(')), [segments])

    // Fetch display names for dynamic segments (IDs)
    useEffect(() => {
        async function fetchNames() {
            if (cleanSegments.length === 0) return

            try {
                const names = await resolveSegmentNames(cleanSegments)
                setDisplayNames(names)
            } catch (error) {
                console.error('Failed to resolve breadcrumb names:', error)
                // On error, names will remain empty and IDs will be shown
            }
        }

        fetchNames()
    }, [cleanSegments]) // Re-fetch when path changes

    // Build breadcrumb structure from segments
    const breadcrumbs = buildBreadcrumbs(cleanSegments, displayNames)

    // Don't render breadcrumbs on home page
    if (breadcrumbs.length === 0) {
        return null
    }

    return (
        <Breadcrumb>
            <BreadcrumbList>
                {breadcrumbs.map((crumb, index) => (
                    <Fragment key={crumb.href}>
                        <BreadcrumbItem className={index === 0 ? 'hidden md:block' : undefined}>
                            {crumb.isCurrent ? (
                                <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                            ) : (
                                <BreadcrumbLink href={crumb.href}>{crumb.label}</BreadcrumbLink>
                            )}
                        </BreadcrumbItem>
                        {index < breadcrumbs.length - 1 && (
                            <BreadcrumbSeparator className={index === 0 ? 'hidden md:block' : undefined} />
                        )}
                    </Fragment>
                ))}
            </BreadcrumbList>
        </Breadcrumb>
    )
}

/**
 * Builds breadcrumb array from URL segments and resolved display names.
 *
 * @param segments - Cleaned URL path segments
 * @param displayNames - Resolved display names for dynamic segments
 * @returns Array of breadcrumb items with labels and hrefs
 */
function buildBreadcrumbs(segments: string[], displayNames: Record<string, string>): BreadcrumbSegment[] {
    const breadcrumbs: BreadcrumbSegment[] = []
    let currentPath = ''

    for (let i = 0; i < segments.length; i++) {
        const segment = segments[i]
        currentPath += `/${segment}`

        // Determine label for this segment
        let label: string

        if (isDynamicSegment(segment)) {
            // Dynamic segment (ID) - use resolved name or fallback to shortened ID
            label = displayNames[segment] || `${segment.substring(0, 8)}...`
        } else {
            // Static segment - use configured label or capitalize
            label = STATIC_SEGMENT_LABELS[segment] || capitalize(segment)
        }

        // Last segment is current page (not clickable)
        const isCurrent = i === segments.length - 1

        breadcrumbs.push({
            segment,
            label,
            href: currentPath,
            isCurrent,
        })
    }

    return breadcrumbs
}

/**
 * Capitalizes first letter of a string.
 */
function capitalize(str: string): string {
    if (!str) return str
    return str.charAt(0).toUpperCase() + str.slice(1)
}
