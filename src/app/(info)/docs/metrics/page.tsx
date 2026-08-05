import type { Metadata } from 'next'

import { SolvNSection } from './_components/solv-n-section'
import { TopKAccuracySection } from './_components/topk-accuracy-section'

export const metadata: Metadata = {
    title: 'Metrics - SynthArena Docs',
    description: 'Understanding SynthArena evaluation metrics: Tier-0 validity, Solv-0, and Top-K Accuracy',
}

export default function MetricsPage() {
    return (
        <div className="container max-w-4xl py-4">
            <div className="space-y-2">
                <h1 className="text-3xl font-bold tracking-tight">Metrics</h1>
                <p className="text-muted-foreground text-lg">
                    SynthArena separates route validity from stock-constrained target success using the Solv-N
                    framework.
                </p>
            </div>

            <div className="mt-8 space-y-8">
                <SolvNSection />
                <TopKAccuracySection />
            </div>
        </div>
    )
}
