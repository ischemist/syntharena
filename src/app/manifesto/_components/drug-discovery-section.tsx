export function DrugDiscoverySection() {
    return (
        <section className="space-y-6">
            <h2 className="text-3xl font-bold">The Synthetic Accessibility Bottleneck</h2>

            <p className="leading-relaxed">
                Why does retrosynthesis matter beyond theoretical elegance? Consider the practical workflow of modern
                drug discovery.
            </p>

            <div className="space-y-4">
                <div>
                    <h3 className="mb-2 text-xl font-semibold">The Current Pipeline</h3>
                    <ol className="list-inside list-decimal space-y-2">
                        <li className="leading-relaxed">
                            Virtual screening generates millions of candidate molecules with promising predicted
                            properties (binding affinity, selectivity, drug-likeness)
                        </li>
                        <li className="leading-relaxed">
                            Synthetic accessibility filters rank candidates by a heuristic score
                        </li>
                        <li className="leading-relaxed">Top candidates are forwarded to medicinal chemists</li>
                        <li className="leading-relaxed">
                            Chemists manually design synthetic routes (or determine synthesis is impractical)
                        </li>
                    </ol>
                </div>

                <div className="bg-muted/50 space-y-3 rounded-lg p-6">
                    <h3 className="text-xl font-semibold">The Problem with Heuristic Scores</h3>
                    <p className="leading-relaxed">
                        Current accessibility metrics (SAScore, RAscore, SCScore) are statistical correlations with
                        known synthesizable molecules. They are pattern-matching algorithms trained on implicit
                        features.
                    </p>
                    <p className="leading-relaxed">
                        A molecule with a predicted accessibility score of 0.85 tells you nothing about:
                    </p>
                    <ul className="list-inside list-disc space-y-1">
                        <li>Whether it requires 3 steps or 12</li>
                        <li>Whether it needs expensive chiral catalysts or commodity reagents</li>
                        <li>Whether key intermediates are commercially available</li>
                        <li>
                            <em>Why</em> it received that score
                        </li>
                    </ul>
                </div>
            </div>

            <p className="leading-relaxed">
                This is not a criticism of existing tools—they are optimizing for the best possible performance given
                their constraints. But the constraint itself is the problem.
            </p>

            <div className="border-muted space-y-2 border-l-4 py-2 pl-6">
                <p className="text-lg font-medium">
                    To assess synthesis difficulty without generating a pathway requires learning all possible pathways
                    implicitly.
                </p>
                <p className="text-muted-foreground text-lg italic">
                    You cannot judge the difficulty of a journey you cannot first articulate.
                </p>
            </div>

            <p className="leading-relaxed">
                A model with true retrosynthetic capability can provide what heuristics cannot: explicit routes, cost
                estimates, bottleneck identification, and actionable chemical insight. This is the difference between a
                correlation and an explanation.
            </p>
        </section>
    )
}
