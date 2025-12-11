import type { Metadata } from 'next'
import Link from 'next/link'

import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export const metadata: Metadata = {
    title: 'Documentation',
    description: 'Learn how SynthArena evaluates multistep retrosynthesis models',
}

export default function DocsPage() {
    return (
        <div className="max-w-4xl py-4">
            <div className="space-y-8">
                {/* Header */}
                <div className="space-y-4">
                    <h1 className="text-4xl font-bold tracking-tight">Documentation</h1>
                    <p className="text-muted-foreground text-lg">
                        Learn how SynthArena evaluates multistep retrosynthesis models using standardized benchmarks and
                        rigorous metrics.
                    </p>
                </div>

                {/* Main Documentation Topics */}
                <section className="py-4">
                    <h2 className="mb-4 text-2xl font-semibold">Core Topics</h2>
                    <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
                        <Link href="/docs/how-it-works" className="h-full">
                            <Card variant="clickable" className="h-full">
                                <CardHeader>
                                    <CardTitle>How It Works</CardTitle>
                                    <CardDescription>
                                        Understand the evaluation framework and data pipeline
                                    </CardDescription>
                                </CardHeader>
                            </Card>
                        </Link>
                        <Link href="/docs/benchmarks" className="h-full">
                            <Card variant="clickable" className="h-full">
                                <CardHeader>
                                    <CardTitle>Benchmarks</CardTitle>
                                    <CardDescription>
                                        Choose the right dataset for your evaluation needs
                                    </CardDescription>
                                </CardHeader>
                            </Card>
                        </Link>
                        <Link href="/docs/metrics" className="h-full">
                            <Card variant="clickable" className="h-full">
                                <CardHeader>
                                    <CardTitle>Metrics</CardTitle>
                                    <CardDescription>
                                        Interpret performance measurements and confidence intervals
                                    </CardDescription>
                                </CardHeader>
                            </Card>
                        </Link>
                    </div>
                </section>

                {/* Additional Resources */}
                <section className="border-t pt-8">
                    <h2 className="mb-4 text-2xl font-semibold">Additional Resources</h2>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <Link href="/thesis" className="h-full">
                            <Card variant="clickable" className="h-full">
                                <CardHeader>
                                    <CardTitle>Why This Exists</CardTitle>
                                    <CardDescription>The vision and philosophy behind SynthArena</CardDescription>
                                </CardHeader>
                            </Card>
                        </Link>
                        <a
                            href="https://retrocast.ischemist.com"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="h-full"
                        >
                            <Card variant="clickable" className="h-full">
                                <CardHeader>
                                    <CardTitle>RetroCast Docs</CardTitle>
                                    <CardDescription>Technical documentation and CLI reference</CardDescription>
                                </CardHeader>
                            </Card>
                        </a>
                        <a
                            href="https://arxiv.org/abs/2512.07079"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="h-full"
                        >
                            <Card variant="clickable" className="h-full">
                                <CardHeader>
                                    <CardTitle>Research Paper</CardTitle>
                                    <CardDescription>Read the full academic publication</CardDescription>
                                </CardHeader>
                            </Card>
                        </a>
                        <a
                            href="https://github.com/ischemist/retrocast"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="h-full"
                        >
                            <Card variant="clickable" className="h-full">
                                <CardHeader>
                                    <CardTitle>GitHub Repository</CardTitle>
                                    <CardDescription>Access the source code and contribute</CardDescription>
                                </CardHeader>
                            </Card>
                        </a>
                    </div>
                </section>
            </div>
        </div>
    )
}
