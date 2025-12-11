import type { Metadata } from 'next'

import { SolvabilitySection } from './_components/solvability-section'
import { TopKAccuracySection } from './_components/topk-accuracy-section'

export const metadata: Metadata = {
    title: 'Metrics - SynthArena Docs',
    description: 'Understanding SynthArena evaluation metrics: Solvability and Top-K Accuracy',
}

export default function MetricsPage() {
    return (
        <div className="container max-w-4xl py-4">
            <div className="space-y-2">
                <h1 className="text-3xl font-bold tracking-tight">Metrics</h1>
                <p className="text-muted-foreground text-lg">
                    SynthArena evaluates retrosynthesis models using two core metrics: Solvability and Top-K Accuracy.
                </p>
            </div>

            <div className="mt-8 space-y-8">
                <SolvabilitySection />
                <TopKAccuracySection />
            </div>
        </div>
    )
}
