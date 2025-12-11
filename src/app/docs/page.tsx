import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, BarChart3, FlaskConical, Github, Lightbulb, ScrollText, Workflow } from 'lucide-react'

import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table'

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
                    <Table>
                        <TableBody>
                            <TableRow className="hover:bg-muted/50">
                                <TableCell className="w-12">
                                    <div className="bg-primary/10 text-primary flex size-10 items-center justify-center rounded-lg">
                                        <Workflow className="size-5" />
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <Link href="/docs/how-it-works" className="block">
                                        <div className="font-semibold">How It Works</div>
                                        <div className="text-muted-foreground text-sm">
                                            Understand the evaluation framework and data pipeline
                                        </div>
                                    </Link>
                                </TableCell>
                                <TableCell className="w-8">
                                    <Link href="/docs/how-it-works">
                                        <ArrowRight className="text-muted-foreground hover:text-foreground size-4 transition-colors" />
                                    </Link>
                                </TableCell>
                            </TableRow>
                            <TableRow className="hover:bg-muted/50">
                                <TableCell className="w-12">
                                    <div className="bg-primary/10 text-primary flex size-10 items-center justify-center rounded-lg">
                                        <FlaskConical className="size-5" />
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <Link href="/docs/benchmarks" className="block">
                                        <div className="font-semibold">Benchmarks</div>
                                        <div className="text-muted-foreground text-sm">
                                            Choose the right dataset for your evaluation needs
                                        </div>
                                    </Link>
                                </TableCell>
                                <TableCell className="w-8">
                                    <Link href="/docs/benchmarks">
                                        <ArrowRight className="text-muted-foreground hover:text-foreground size-4 transition-colors" />
                                    </Link>
                                </TableCell>
                            </TableRow>
                            <TableRow className="hover:bg-muted/50">
                                <TableCell className="w-12">
                                    <div className="bg-primary/10 text-primary flex size-10 items-center justify-center rounded-lg">
                                        <BarChart3 className="size-5" />
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <Link href="/docs/metrics" className="block">
                                        <div className="font-semibold">Metrics</div>
                                        <div className="text-muted-foreground text-sm">
                                            Interpret performance measurements and confidence intervals
                                        </div>
                                    </Link>
                                </TableCell>
                                <TableCell className="w-8">
                                    <Link href="/docs/metrics">
                                        <ArrowRight className="text-muted-foreground hover:text-foreground size-4 transition-colors" />
                                    </Link>
                                </TableCell>
                            </TableRow>
                        </TableBody>
                    </Table>
                </section>

                {/* Additional Resources */}
                <section className="border-t pt-8">
                    <h2 className="mb-4 text-2xl font-semibold">Additional Resources</h2>
                    <Table>
                        <TableBody>
                            <TableRow className="hover:bg-muted/50">
                                <TableCell className="w-12">
                                    <div className="bg-primary/10 text-primary flex size-10 items-center justify-center rounded-lg">
                                        <Lightbulb className="size-5" />
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <Link href="/manifesto" className="block">
                                        <div className="font-semibold">Manifesto</div>
                                        <div className="text-muted-foreground text-sm">
                                            The vision and philosophy behind SynthArena
                                        </div>
                                    </Link>
                                </TableCell>
                                <TableCell className="w-8">
                                    <Link href="/manifesto">
                                        <ArrowRight className="text-muted-foreground hover:text-foreground size-4 transition-colors" />
                                    </Link>
                                </TableCell>
                            </TableRow>
                            <TableRow className="hover:bg-muted/50">
                                <TableCell className="w-12">
                                    <div className="bg-muted flex size-10 items-center justify-center rounded-lg font-mono text-xs font-semibold">
                                        RC
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <a
                                        href="https://retrocast.ischemist.com"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="block"
                                    >
                                        <div className="font-semibold">RetroCast Docs</div>
                                        <div className="text-muted-foreground text-sm">
                                            Technical documentation and CLI reference
                                        </div>
                                    </a>
                                </TableCell>
                                <TableCell className="w-8">
                                    <a href="https://retrocast.ischemist.com" target="_blank" rel="noopener noreferrer">
                                        <ArrowRight className="text-muted-foreground hover:text-foreground size-4 transition-colors" />
                                    </a>
                                </TableCell>
                            </TableRow>
                            <TableRow className="hover:bg-muted/50">
                                <TableCell className="w-12">
                                    <div className="bg-primary/10 text-primary flex size-10 items-center justify-center rounded-lg">
                                        <ScrollText className="size-5" />
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <a
                                        href="https://arxiv.org/abs/2512.07079"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="block"
                                    >
                                        <div className="font-semibold">Research Paper</div>
                                        <div className="text-muted-foreground text-sm">
                                            Read the full academic publication
                                        </div>
                                    </a>
                                </TableCell>
                                <TableCell className="w-8">
                                    <a
                                        href="https://arxiv.org/abs/2512.07079"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                    >
                                        <ArrowRight className="text-muted-foreground hover:text-foreground size-4 transition-colors" />
                                    </a>
                                </TableCell>
                            </TableRow>
                            <TableRow className="hover:bg-muted/50">
                                <TableCell className="w-12">
                                    <div className="bg-primary/10 text-primary flex size-10 items-center justify-center rounded-lg">
                                        <Github className="size-5" />
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <a
                                        href="https://github.com/ischemist/retrocast"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="block"
                                    >
                                        <div className="font-semibold">GitHub Repository</div>
                                        <div className="text-muted-foreground text-sm">
                                            Access the source code and contribute
                                        </div>
                                    </a>
                                </TableCell>
                                <TableCell className="w-8">
                                    <a
                                        href="https://github.com/ischemist/retrocast"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                    >
                                        <ArrowRight className="text-muted-foreground hover:text-foreground size-4 transition-colors" />
                                    </a>
                                </TableCell>
                            </TableRow>
                        </TableBody>
                    </Table>
                </section>
            </div>
        </div>
    )
}
