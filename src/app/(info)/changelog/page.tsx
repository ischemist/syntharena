import type { Metadata } from 'next'

import { ChangeType, VersionBlock } from './_components/version-block'

export const metadata: Metadata = {
    title: 'Changelog',
    description: 'Track the evolution of SynthArena with our detailed release history',
}

const versions = [
    {
        version: 'v0.2.1',
        date: 'December 10, 2025',
        changes: [
            {
                type: ChangeType.DOCS,
                description: 'Added thesis, changelog, roadmap, submitting results informational pages and docs',
            },
        ],
    },
    {
        version: 'v0.2.0',
        date: 'December 9, 2025',
        changes: [
            {
                type: ChangeType.FEAT,
                description: 'Replaced benchmark definition from a single ground truth to a list of acceptable routes',
            },
            {
                type: ChangeType.FEAT,
                description: 'Added runtime statistics and total cost of each run',
            },
            {
                type: ChangeType.UI_UX,
                description: 'Now you can see (and filter by) source of Buyable compounds and price per gram',
            },
            {
                type: ChangeType.DATA,
                description: 'Updated SynthArena with all runs reported in the preprint',
            },
        ],
    },
    {
        version: 'v0.1.0',
        date: 'November 30, 2025',
        changes: [
            {
                type: ChangeType.FEAT,
                description: 'Initial public release of SynthArena platform',
            },
            {
                type: ChangeType.FEAT,
                description: 'Visualization of stocks, benchmark targets, model runs, leaderboard',
            },
            {
                type: ChangeType.FEAT,
                description:
                    'Interactive route visualization with side-by-side comparison to reference routes and overlay mode',
            },
        ],
    },
]

export default function ChangelogPage() {
    return (
        <div className="max-w-4xl py-4">
            <div className="mb-8">
                <h1 className="mb-2 text-4xl font-bold tracking-tight">Changelog</h1>
                <p className="text-muted-foreground text-lg">
                    Track the evolution of SynthArena with our detailed release history
                </p>
            </div>

            <div className="space-y-8">
                {versions.map((version) => (
                    <VersionBlock
                        key={version.version}
                        version={version.version}
                        date={version.date}
                        changes={version.changes}
                    />
                ))}
            </div>
        </div>
    )
}
