import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, BarChart3, FlaskConical, Lightbulb, Workflow } from 'lucide-react'

import { Button } from '@/components/ui/button'

import { DocsNavCard } from './_components/docs-nav-card'

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

                {/* Main Navigation Cards */}
                <div className="grid gap-6 md:grid-cols-3">
                    <DocsNavCard
                        title="How It Works"
                        description="Understand the evaluation framework and data pipeline"
                        href="/docs/how-it-works"
                        icon={Workflow}
                    />
                    <DocsNavCard
                        title="Benchmarks"
                        description="Choose the right dataset for your evaluation needs"
                        href="/docs/benchmarks"
                        icon={FlaskConical}
                    />
                    <DocsNavCard
                        title="Metrics"
                        description="Interpret performance measurements and confidence intervals"
                        href="/docs/metrics"
                        icon={BarChart3}
                    />
                </div>

                {/* Additional Resources */}
                <div className="border-t pt-8">
                    <h2 className="mb-4 text-2xl font-semibold">Additional Resources</h2>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <Link href="/manifesto">
                            <Button variant="outline" className="h-auto w-full justify-start gap-2 py-4">
                                <Lightbulb className="size-5 shrink-0" />
                                <div className="flex flex-col items-start gap-1 text-left">
                                    <span className="font-semibold">Manifesto</span>
                                    <span className="text-muted-foreground text-xs font-normal">
                                        The vision and philosophy behind SynthArena
                                    </span>
                                </div>
                                <ArrowRight className="ml-auto size-4 shrink-0" />
                            </Button>
                        </Link>
                        <a href="https://retrocast.ischemist.com" target="_blank" rel="noopener noreferrer">
                            <Button variant="outline" className="h-auto w-full justify-start gap-2 py-4">
                                <div className="bg-muted flex size-5 shrink-0 items-center justify-center rounded font-mono text-xs font-semibold">
                                    RC
                                </div>
                                <div className="flex flex-col items-start gap-1 text-left">
                                    <span className="font-semibold">RetroCast Docs</span>
                                    <span className="text-muted-foreground text-xs font-normal">
                                        Technical documentation and CLI reference
                                    </span>
                                </div>
                                <ArrowRight className="ml-auto size-4 shrink-0" />
                            </Button>
                        </a>
                        <a href="https://arxiv.org/abs/2512.07079" target="_blank" rel="noopener noreferrer">
                            <Button variant="outline" className="h-auto w-full justify-start gap-2 py-4">
                                <div className="bg-muted flex size-5 shrink-0 items-center justify-center rounded font-mono text-xs font-semibold">
                                    ar
                                </div>
                                <div className="flex flex-col items-start gap-1 text-left">
                                    <span className="font-semibold">Research Paper</span>
                                    <span className="text-muted-foreground text-xs font-normal">
                                        Read the full academic publication
                                    </span>
                                </div>
                                <ArrowRight className="ml-auto size-4 shrink-0" />
                            </Button>
                        </a>
                        <a href="https://github.com/ischemist/retrocast" target="_blank" rel="noopener noreferrer">
                            <Button variant="outline" className="h-auto w-full justify-start gap-2 py-4">
                                <div className="bg-muted flex size-5 shrink-0 items-center justify-center rounded font-mono text-xs font-semibold">
                                    gh
                                </div>
                                <div className="flex flex-col items-start gap-1 text-left">
                                    <span className="font-semibold">GitHub Repository</span>
                                    <span className="text-muted-foreground text-xs font-normal">
                                        Access the source code and contribute
                                    </span>
                                </div>
                                <ArrowRight className="ml-auto size-4 shrink-0" />
                            </Button>
                        </a>
                    </div>
                </div>
            </div>
        </div>
    )
}
