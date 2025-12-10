import Link from 'next/link'

export function InfrastructureSection() {
    return (
        <section className="space-y-6">
            <h2 className="text-3xl font-bold">The Infrastructure Pattern</h2>

            <p className="leading-relaxed">
                Scientific breakthroughs rarely emerge in isolation. They are preceded—often by years—by the
                construction of shared evaluation infrastructure.
            </p>

            <div className="space-y-4">
                <div className="bg-muted/50 space-y-4 rounded-lg p-6">
                    <h3 className="text-xl font-semibold">Historical Precedents</h3>
                    <div className="space-y-3 text-sm">
                        <div className="flex items-start gap-4">
                            <span className="text-muted-foreground shrink-0 font-mono">2009</span>
                            <div>
                                <strong>ImageNet</strong> provides standardized image classification benchmark
                                <div className="text-muted-foreground">→ ResNet, VGG, Inception (2014-2016)</div>
                            </div>
                        </div>
                        <div className="flex items-start gap-4">
                            <span className="text-muted-foreground shrink-0 font-mono">2018</span>
                            <div>
                                <strong>GLUE/SuperGLUE</strong> standardize NLP evaluation tasks
                                <div className="text-muted-foreground">→ BERT, GPT-2, GPT-3 (2018-2020)</div>
                            </div>
                        </div>
                        <div className="flex items-start gap-4">
                            <span className="text-muted-foreground shrink-0 font-mono">1994</span>
                            <div>
                                <strong>CASP</strong> competition for protein structure prediction
                                <div className="text-muted-foreground">→ AlphaFold (2018-2020)</div>
                            </div>
                        </div>
                    </div>
                </div>

                <p className="leading-relaxed">
                    The pattern is consistent: standardized, reproducible evaluation infrastructure precedes major
                    algorithmic advances. Benchmarks do not merely measure progress—they enable it by creating shared
                    definitions of success.
                </p>
            </div>

            <div className="space-y-3">
                <h3 className="text-xl font-semibold">The Current State in Retrosynthesis</h3>
                <p className="leading-relaxed">The field lacks this foundation:</p>
                <ul className="list-inside list-disc space-y-1">
                    <li>No standardized output format</li>
                    <li>No consistent benchmark definitions</li>
                    <li>No reproducible evaluation protocol</li>
                    <li>No agreement on stock sets</li>
                    <li>No chemical validity checks</li>
                </ul>
                <p className="leading-relaxed font-medium">
                    The field is pre-ImageNet. Infrastructure must precede breakthroughs.
                </p>
            </div>

            <div className="border-primary space-y-4 border-l-4 py-2 pl-6">
                <h3 className="text-2xl font-semibold">What RetroCast Provides</h3>

                <div className="space-y-3">
                    <div>
                        <h4 className="font-semibold">1. Universal Translation Layer</h4>
                        <p className="text-muted-foreground text-sm">
                            Adapters for 10+ models (AiZynthFinder, Retro*, ASKCOS, DirectMultiStep, and more) that cast
                            all outputs into a canonical schema. Every route becomes comparable.
                        </p>
                    </div>

                    <div>
                        <h4 className="font-semibold">2. Curated, Stratified Benchmarks</h4>
                        <p className="text-muted-foreground text-sm">
                            Two evaluation tracks: <code className="bg-muted px-1">mkt-</code> series with commercial
                            stocks for practical utility; <code className="bg-muted px-1">ref-</code> series with
                            standardized stocks for fair algorithmic comparison. All statistically validated for
                            stability.
                        </p>
                    </div>

                    <div>
                        <h4 className="font-semibold">3. Multi-Ground-Truth Evaluation</h4>
                        <p className="text-muted-foreground text-sm">
                            Expands acceptable solutions beyond rigid single-reference routes to include valid,
                            commercially-terminated sub-routes—a step toward rewarding both accuracy and creativity.
                        </p>
                    </div>

                    <div>
                        <h4 className="font-semibold">4. Cryptographic Provenance</h4>
                        <p className="text-muted-foreground text-sm">
                            Every processing stage generates SHA256 manifests. All results are computationally
                            verifiable. Reproducibility is not aspirational—it is enforced.
                        </p>
                    </div>

                    <div>
                        <h4 className="font-semibold">5. SynthArena Platform</h4>
                        <p className="text-muted-foreground text-sm">
                            Interactive visualization for side-by-side route comparison, stratified performance metrics
                            with bootstrapped confidence intervals, and a living leaderboard. Evaluation becomes
                            continuous, not episodic.
                        </p>
                    </div>
                </div>
            </div>

            <p className="leading-relaxed">
                RetroCast is not a model. It is not a method. It is infrastructure: the translation layer, benchmarks,
                and evaluation protocol that the field needs to make progress measurable and reproducible.
            </p>

            <p className="text-muted-foreground text-sm">
                Full technical details and source code:{' '}
                <Link
                    href="https://github.com/ischemist/project-procrustes"
                    className="hover:text-foreground underline"
                    target="_blank"
                >
                    github.com/ischemist/project-procrustes
                </Link>
            </p>
        </section>
    )
}
