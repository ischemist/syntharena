export function DrugDiscoverySection() {
    return (
        <section className="space-y-6">
            <h2 className="text-2xl font-bold">Synthesis-Aware Virtual Screening</h2>

            <p className="leading-relaxed">
                One critical downstream application of retrosynthetic planning is synthesis-aware virtual screening.
                Modern drug discovery generates millions of candidate molecules with promising predicted properties,
                then filters them by synthetic accessibility before forwarding to medicinal chemists. This workflow
                demands the transferable chemical knowledge that retrosynthesis mastery provides.
            </p>

            <p className="leading-relaxed">
                Current practice ranks candidates by synthetic accessibility scores (SAScore, RAscore, SCScore)—
                reasonable heuristics for a fundamentally ill-defined problem. A molecule with an accessibility score of
                0.85 tells you nothing about whether it requires 3 steps or 12, whether it needs expensive chiral
                catalysts or commodity reagents, whether key intermediates are commercially available. The underlying
                issue is that <em>synthetic accessibility is inherently conditional</em>: it depends on which reactions
                you can execute, which stock compounds you&apos;re willing to use, what your budget constraints are,
                what equipment and expertise you have access to. A decontextualized scalar score cannot capture this
                complexity—not because these methods are inadequate, but because the problem they address resists
                reduction to a single number.
            </p>

            <p className="leading-relaxed">
                The path forward requires explicit route generation. To meaningfully assess synthetic feasibility, a
                model must first generate a concrete pathway, then evaluate that pathway in context: step count, reagent
                costs, stock availability, reaction reliability. Perhaps a sufficiently capable model could predict
                difficulty labels before generating complete routes—analogous to chain-of-thought reasoning—but even
                this requires the underlying capacity for route generation.
            </p>

            <div className="border-primary border-l-4 py-2 pl-6">
                <p className="font-medium">
                    A model cannot judge the difficulty of a journey it cannot first articulate.
                </p>
            </div>

            <p className="leading-relaxed">
                This is why retrosynthetic capability is foundational: it transforms an ill-defined ranking problem into
                a well-defined generation and evaluation problem.
            </p>
        </section>
    )
}
