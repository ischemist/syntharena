import * as React from 'react'

/**
 * Provides a structured two-row header for the runs page.
 * Row 1: page title and description.
 * Row 2: a flex container for controls (tabs, filters) passed as children.
 */
export function RunsPageHeader({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex flex-col gap-4">
            {/* --- Row 1: Context --- */}
            <div className="space-y-1">
                <h1 className="text-3xl font-bold tracking-tight">Model Runs</h1>
                <p className="text-muted-foreground">Browse and filter prediction runs from retrosynthesis models.</p>
            </div>
            {/* --- Row 2: Controls --- */}
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">{children}</div>
        </div>
    )
}
