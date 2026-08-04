export function ProblemSolutionSection() {
    return (
        <section className="grid gap-8 py-8 md:grid-cols-2">
            <div>
                <h2 className="mb-4 text-2xl font-semibold">The Evaluation Crisis</h2>
                <div className="text-muted-foreground space-y-3 text-sm">
                    <p>
                        <strong className="text-foreground">The Babel of Formats:</strong> AiZynthFinder outputs
                        bipartite graphs; Retro* outputs precursor maps; DirectMultiStep outputs recursive dictionaries.
                        Comparing them requires bespoke parsers for every model.
                    </p>
                    <p>
                        <strong className="text-foreground">Inconsistent Stocks:</strong> Starting material definitions
                        vary by over 1000×—from off-the-shelf catalogs of 300k molecules to made-to-order libraries of
                        230M+ compounds—so a stock label is part of every Solv-N metric identity.
                    </p>
                    <p>
                        <strong className="text-foreground">Distinct validity predicates:</strong> Syntactic validity,
                        stock termination, reaction topology, and reaction-level evidence answer different questions.
                        Collapsing them into one &quot;solved&quot; label overstates what was checked.
                    </p>
                </div>
            </div>
            <div>
                <h2 className="mb-4 text-2xl font-semibold">The Solution</h2>
                <div className="text-muted-foreground space-y-3 text-sm">
                    <p>
                        <strong className="text-foreground">RetroCast:</strong> A universal translation layer providing
                        adapters for 10+ models (AiZynthFinder, Retro*, ASKCOS, DirectMultiStep, and more), casting all
                        outputs into a canonical schema with cryptographic manifests for reproducibility.
                    </p>
                    <p>
                        <strong className="text-foreground">Curated Benchmarks:</strong> Stratified evaluation sets
                        fixing PaRoutes&apos; distribution skew. The <em>mkt-</em> series uses commercial stocks
                        (Buyables) for practical utility; the <em>ref-</em> series uses standardized stocks for fair
                        algorithmic comparison.
                    </p>
                    <p>
                        <strong className="text-foreground">SynthArena:</strong> This platform provides side-by-side
                        route comparison with diff overlays, bootstrapped confidence intervals, and a living
                        leaderboard—turning evaluation from a static exercise into an ongoing community process.
                    </p>
                </div>
            </div>
        </section>
    )
}
