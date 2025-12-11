import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, ExternalLink } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'

import { BenchmarksTable } from './_components/benchmarks-table'
import { Terminology } from './_components/terminology'
import { WhyStratified } from './_components/why-stratified'

export const metadata: Metadata = {
    title: 'Benchmarks',
    description: 'Choose the right benchmark dataset for evaluating retrosynthesis models',
}

export default function BenchmarksDocPage() {
    return (
        <div className="max-w-5xl py-4">
            <article className="space-y-10">
                {/* Header */}
                <div className="space-y-3">
                    <h1 className="text-3xl font-bold tracking-tight">Benchmarks</h1>
                    <p className="text-muted-foreground text-lg">
                        Stratified evaluation subsets from PaRoutes designed to measure performance across route
                        lengths, topologies, and material availability.
                    </p>
                </div>

                {/* Benchmarks Table - Lead with data */}
                <section className="space-y-3">
                    <h2 className="text-xl font-semibold">Available Benchmarks</h2>
                    <BenchmarksTable />
                </section>

                {/* Series Guide */}
                <section className="space-y-4">
                    <h2 className="text-xl font-semibold">Which Benchmark Should I Use?</h2>
                    <div className="prose space-y-4">
                        <p>
                            Are you a chemist looking for the best model to use right now with commercially available
                            materials? Use <strong>Market Series (mkt-*)</strong>.
                        </p>

                        <p>
                            Are you an algorithm developer who wants fair comparison against other approaches? Use{' '}
                            <strong>Reference Series (ref-*)</strong>.
                        </p>
                    </div>
                </section>

                {/* Why Stratified */}
                <section className="space-y-4">
                    <h2 className="text-xl font-semibold">Why Stratified Benchmarks?</h2>
                    <WhyStratified />
                </section>

                {/* Terminology */}
                <section className="space-y-4">
                    <h2 className="text-xl font-semibold">Key Terminology</h2>
                    <Terminology />
                </section>

                {/* Training Data Decontamination */}
                <Alert>
                    <AlertTitle>Training Data Decontamination</AlertTitle>
                    <AlertDescription>
                        For fair comparison, remove benchmark targets from your training set. Filter by route signatures
                        after converting your routes to RetroCast schema.
                    </AlertDescription>
                </Alert>

                {/* Next Steps */}
                <section className="space-y-4 border-t pt-8">
                    <h2 className="text-xl font-semibold">Next Steps</h2>
                    <div className="flex flex-wrap gap-3">
                        <Link href="/benchmarks">
                            <Button variant="default">
                                Browse Benchmarks
                                <ArrowRight className="ml-2 size-4" />
                            </Button>
                        </Link>
                        <Link href="/leaderboard">
                            <Button variant="outline">
                                View Leaderboard
                                <ArrowRight className="ml-2 size-4" />
                            </Button>
                        </Link>
                        <a href="https://retrocast.ischemist.com/benchmarks" target="_blank" rel="noopener noreferrer">
                            <Button variant="outline">
                                Technical Documentation
                                <ExternalLink className="ml-2 size-4" />
                            </Button>
                        </a>
                    </div>
                </section>
            </article>
        </div>
    )
}
