import type { Metadata } from 'next'

import { AdapterExplanationSection } from './_components/adapter-explanation-section'
import { PipelineStagesSection } from './_components/pipeline-stages-section'

export const metadata: Metadata = {
    title: 'How It Works',
    description: 'Understand the SynthArena evaluation framework and data pipeline',
}

export default function HowItWorksPage() {
    return (
        <div className="max-w-4xl py-4">
            <article className="prose prose-slate dark:prose-invert mx-auto space-y-6">
                {/* Header */}
                <div className="space-y-2">
                    <h1 className="text-3xl font-bold tracking-tight">How It Works</h1>
                    <p className="text-muted-foreground">
                        SynthArena uses a standardized evaluation framework that ensures fair, apples-to-apples
                        comparisons across different retrosynthesis models.
                    </p>
                </div>

                {/* Sections */}
                <AdapterExplanationSection />
                <PipelineStagesSection />
            </article>
        </div>
    )
}
