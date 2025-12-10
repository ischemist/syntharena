import Link from 'next/link'

export function MeasurementSection() {
    return (
        <section className="space-y-6">
            <h2 className="text-3xl font-bold">Why We Cannot Answer &ldquo;Which Model Is Best&rdquo;</h2>

            <p className="leading-relaxed">
                If retrosynthesis is the strategic challenge for chemistry AI, a natural question follows: Which of the
                existing models should we use?
            </p>

            <p className="leading-relaxed">
                This question is currently unanswerable. Not because the models are similar, but because we lack the
                infrastructure to compare them.
            </p>

            <div className="space-y-6">
                <div className="space-y-3">
                    <h3 className="text-xl font-semibold">Problem 1: The Babel of Formats</h3>
                    <p className="leading-relaxed">
                        Different retrosynthesis tools output fundamentally incompatible data structures for the same
                        synthetic route:
                    </p>
                    <ul className="text-muted-foreground list-inside list-disc space-y-1">
                        <li>AiZynthFinder: bipartite graphs with molecule and reaction nodes</li>
                        <li>Retro*: precursor maps (product → reactants dictionaries)</li>
                        <li>DirectMultiStep: nested recursive dictionaries</li>
                        <li>ASKCOS: node-edge lists with separate node registries</li>
                        <li>SynLLaMa: linear recipe strings</li>
                    </ul>
                    <p className="leading-relaxed">
                        Any comparative analysis requires writing bespoke parsers for every model—a barrier that makes
                        large-scale evaluation impractical.
                    </p>
                </div>

                <div className="space-y-3">
                    <h3 className="text-xl font-semibold">Problem 2: Stock Set Chaos</h3>
                    <p className="leading-relaxed">
                        The definition of a &ldquo;solved&rdquo; route depends on which molecules are considered
                        available starting materials. Our survey revealed that stock sets vary by over{' '}
                        <strong>three orders of magnitude</strong>:
                    </p>
                    <div className="bg-muted/50 space-y-1 rounded p-4 text-sm">
                        <div className="flex justify-between">
                            <span>Curated catalogs (Enamine, MolPort):</span>
                            <span className="font-mono">~300k compounds</span>
                        </div>
                        <div className="flex justify-between">
                            <span>eMolecules screening library:</span>
                            <span className="font-mono">~230M compounds</span>
                        </div>
                        <div className="flex justify-between font-semibold">
                            <span>Variance:</span>
                            <span className="font-mono">~1000×</span>
                        </div>
                    </div>
                    <p className="leading-relaxed">
                        A model reporting 99% solvability against a 230M compound library and another reporting 75%
                        against a 300k catalog are incomparable. The metric conflates model capability with stock
                        definition.
                    </p>
                </div>

                <div className="space-y-3">
                    <h3 className="text-xl font-semibold">Problem 3: Validity Blindness</h3>
                    <p className="leading-relaxed">
                        The dominant metric—Stock-Termination Rate (STR, often called
                        &ldquo;solvability&rdquo;)—validates only that a route&apos;s terminal nodes exist in a
                        commercial stock. It provides <em>no guarantee</em> that intermediate transformations are
                        chemically feasible.
                    </p>
                    <p className="leading-relaxed">
                        Our analysis of top-performing models revealed routes scoring as &ldquo;solved&rdquo; despite
                        containing:
                    </p>
                    <ul className="text-muted-foreground list-inside list-disc space-y-1">
                        <li>Seven-reactant combinations with no plausible mechanism</li>
                        <li>Mass balance violations (atoms appearing from nowhere)</li>
                        <li>Chemically nonsensical transformations (tartaric acid as a propargyl source)</li>
                    </ul>
                    <p className="leading-relaxed">
                        High STR scores can be achieved by finding <em>any</em> topological path to commercial
                        molecules, regardless of chemical validity. This is measurement failure masquerading as
                        progress.
                    </p>
                </div>
            </div>

            <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 dark:border-amber-900 dark:bg-amber-950/20">
                <p className="leading-relaxed font-medium text-amber-900 dark:text-amber-100">
                    These are not minor inconveniences. They make rigorous model comparison impossible. Progress
                    requires infrastructure before it requires new models.
                </p>
            </div>

            <p className="text-muted-foreground text-sm">
                For detailed examples of chemically invalid &ldquo;solved&rdquo; routes, see Figure 2 in{' '}
                <Link
                    href="https://arxiv.org/abs/2512.07079"
                    className="hover:text-foreground underline"
                    target="_blank"
                >
                    our paper
                </Link>
                .
            </p>
        </section>
    )
}
