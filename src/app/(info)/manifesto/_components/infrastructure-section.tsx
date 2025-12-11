import Link from 'next/link'

export function InfrastructureSection() {
    return (
        <section className="space-y-6">
            <h2 className="text-2xl font-bold">The Infrastructure Pattern</h2>

            <p className="leading-relaxed">
                Scientific breakthroughs rarely emerge in isolation. They are preceded (often by years) by the
                construction of shared evaluation infrastructure.
            </p>

            <div className="bg-muted/50 space-y-3 rounded-lg p-6">
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

            <div className="border-primary border-l-4 py-2 pl-6">
                <p className="font-medium">
                    Retrosynthesis is pre-ImageNet. The field lacks standardized output formats, consistent benchmark
                    definitions, reproducible evaluation protocols, agreed-upon stock sets, and chemical validity
                    checks. Infrastructure must precede breakthroughs.
                </p>
            </div>

            <p className="leading-relaxed">
                RetroCast provides this foundation: a universal translation layer with adapters for 10+ models that cast
                all outputs into a canonical schema; curated, stratified benchmarks with two evaluation tracks
                (market-based and reference-based); multi-ground-truth evaluation that rewards valid sub-routes; and
                cryptographic provenance with SHA256 manifests for computational verifiability. SynthArena provides
                interactive visualization, stratified metrics with confidence intervals, and a living leaderboard.
            </p>

            <p className="text-muted-foreground text-sm">
                <Link
                    href="https://retrocast.ischemist.com"
                    className="hover:text-foreground underline"
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    RetroCast Documentation
                </Link>
                {' · '}
                <Link
                    href="https://github.com/ischemist/project-procrustes"
                    className="hover:text-foreground underline"
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    RetroCast Source Code
                </Link>
                {' · '}
                <Link
                    href="https://github.com/ischemist/syntharena"
                    className="hover:text-foreground underline"
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    SynthArena Source Code
                </Link>
            </p>
        </section>
    )
}
