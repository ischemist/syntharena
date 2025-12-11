import type { Metadata } from 'next'

import { RoadmapSection } from './_components/roadmap-section'

export const metadata: Metadata = {
    title: 'Roadmap',
    description: 'Our vision for the future of SynthArena and retrosynthesis evaluation',
}

const roadmapData = {
    immediate: {
        title: 'Immediate',
        subtitle: 'Currently in development (this month)',
        items: [
            'Making the website more mobile-friendly. Fixing Safari specific issues (e.g. clicking on rows in a table)',
        ],
    },
    nearTerm: {
        title: 'Near-term',
        subtitle: 'Planned features (next 1-3 months)',
        items: ['Migration to RDKit for visualization of molecules instead of Smiles-Drawer'],
    },
    longTerm: {
        title: 'Long-term',
        subtitle: 'Vision items (3+ months)',
        items: [
            'Dynamic stock-termination queries - calculating cost of route leaves, filtering by cost of prediction and/or reference route',
        ],
    },
}

export default function RoadmapPage() {
    return (
        <div className="max-w-4xl py-4">
            <div className="mb-8">
                <h1 className="mb-2 text-4xl font-bold tracking-tight">Roadmap</h1>
                <p className="text-muted-foreground text-lg">
                    Our vision for the future of SynthArena and retrosynthesis evaluation
                </p>
            </div>

            <div className="space-y-10">
                <RoadmapSection
                    title={roadmapData.immediate.title}
                    subtitle={roadmapData.immediate.subtitle}
                    items={roadmapData.immediate.items}
                />
                <RoadmapSection
                    title={roadmapData.nearTerm.title}
                    subtitle={roadmapData.nearTerm.subtitle}
                    items={roadmapData.nearTerm.items}
                />
                <RoadmapSection
                    title={roadmapData.longTerm.title}
                    subtitle={roadmapData.longTerm.subtitle}
                    items={roadmapData.longTerm.items}
                />
            </div>
        </div>
    )
}
