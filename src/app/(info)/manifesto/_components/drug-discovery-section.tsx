export function DrugDiscoverySection() {
    return (
        <section className="space-y-6">
            <h2 className="text-2xl font-bold">Synthesis-Aware Virtual Screening</h2>

            <p className="leading-relaxed">
                One critical downstream application of retrosynthetic planning is synthesis-aware virtual screening.
                Modern drug discovery generates millions of candidate molecules, then filters them by synthetic
                accessibility before forwarding to medicinal chemists. This workflow demands the transferable chemical
                knowledge that retrosynthesis mastery provides.
            </p>

            <p className="leading-relaxed">
                Current practice relies on heuristics like SAScore, RAscore, or SCScore to rank these candidates. These
                methods are valuable high-throughput filters, but they rest on a precarious assumption: that synthetic
                accessibility is an <em>intrinsic property</em> of a molecule, akin to molecular weight or LogP.
            </p>

            <p className="leading-relaxed">
                We posit that synthetic accessibility is not a scalar property, but a <strong>conditional state</strong>
                . It relies entirely on context: which starting materials are in your stockroom? Do you have access to
                high-pressure hydrogenation? What is your cost tolerance? A molecule that is &quot;easy&quot; (0.9) for
                a well-stocked pharma lab may be &quot;impossible&quot; (0.1) for a budget-constrained startup. By
                collapsing this complexity into a single number, we may be asking a fundamentally ill-posed question.
            </p>

            <p className="leading-relaxed">
                The path forward requires explicit route generation. To meaningfully assess feasibility, a model must
                first generate a concrete pathway, which can then be evaluated against local realities: step count,
                reagent costs, reaction reliability, and stock availability. Perhaps a sufficiently capable model could
                eventually predict difficulty scores directly (analogous to <em>chain-of-thought reasoning</em>
                where the reasoning step is internal) but even this &quot;fast&quot; prediction requires the underlying
                capacity to articulate the route.
            </p>

            <div className="border-primary border-l-4 py-2 pl-6">
                <p className="font-medium">
                    A model cannot judge the difficulty of a journey it cannot first articulate.
                </p>
            </div>

            <p className="leading-relaxed">
                This is why retrosynthetic capability is foundational: it transforms an ill-defined ranking problem into
                a transparent planning problem.
            </p>
        </section>
    )
}
