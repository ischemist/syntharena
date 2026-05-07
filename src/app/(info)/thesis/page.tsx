import type { Metadata } from 'next'

import { DrugDiscoverySection } from './_components/drug-discovery-section'
import { EvaluationTrackSection } from './_components/evaluation-track-section'
import { FrameworkSection } from './_components/framework-section'
import { HeroSection } from './_components/hero-section'
import { InfrastructureSection } from './_components/infrastructure-section'
import { MeasurementSection } from './_components/measurement-section'
import { RetrosynthesisSection } from './_components/retrosynthesis-section'
import { ValiditySection } from './_components/validity-section'

export const metadata: Metadata = {
    title: 'The Thesis',
    description: 'On structural mastery in chemistry and the infrastructure needed to achieve it',
}

export default function ThesisPage() {
    return (
        <div className="max-w-4xl py-4">
            <article className="prose prose-slate dark:prose-invert prose-lg mx-auto space-y-16">
                <HeroSection />
                <FrameworkSection />
                <RetrosynthesisSection />
                <DrugDiscoverySection />
                <MeasurementSection />
                <InfrastructureSection />
                <ValiditySection />
                <EvaluationTrackSection />

                <footer className="text-muted-foreground not-prose mt-8! space-y-4 border-t pt-6 text-sm">
                    <div className="space-y-2">
                        <p>
                            This December 2025 thesis was the first statement of the argument. It later broadened into{' '}
                            <a
                                href="https://ischemist.com/thesis"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-foreground hover:underline"
                            >
                                ischemist.com/thesis
                            </a>
                            , then into{' '}
                            <a
                                href="https://ischemist.com/syntax-of-matter"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-foreground hover:underline"
                            >
                                Syntax of Matter
                            </a>
                            .
                        </p>
                    </div>
                    <p>
                        <a
                            href="https://arxiv.org/abs/2512.07079"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-foreground hover:underline"
                        >
                            Read the paper
                        </a>
                        {' · '}
                        <a
                            href="https://retrocast.ischemist.com"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-foreground hover:underline"
                        >
                            Read the technical docs
                        </a>
                    </p>
                </footer>
            </article>
        </div>
    )
}
