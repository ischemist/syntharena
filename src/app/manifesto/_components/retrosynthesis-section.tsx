export function RetrosynthesisSection() {
    return (
        <section className="space-y-6">
            <h2 className="text-3xl font-bold">Retrosynthesis as the Structural Challenge</h2>

            <p className="leading-relaxed">
                Given that structural mastery precedes quantitative capability, we must ask: What is chemistry&apos;s
                equivalent to language modeling or protein structure prediction?
            </p>

            <div className="space-y-4">
                <div>
                    <h3 className="mb-2 text-xl font-semibold">Candidates Considered</h3>
                    <ul className="list-inside list-disc space-y-2">
                        <li className="leading-relaxed">
                            <strong>Molecule generation?</strong> Generative models can produce valid SMILES strings,
                            but this is syntax without semantics—there is no constraint that the molecule be
                            synthetically accessible.
                        </li>
                        <li className="leading-relaxed">
                            <strong>Forward reaction prediction?</strong> Predicting products from reactants is
                            valuable, but it is a single-step transformation, not multi-step planning.
                        </li>
                        <li className="leading-relaxed">
                            <strong>Property prediction?</strong> This is a quantitative problem by definition, not a
                            structural one.
                        </li>
                    </ul>
                </div>

                <div className="bg-muted/50 space-y-3 rounded-lg p-6">
                    <h3 className="text-xl font-semibold">Retrosynthesis Satisfies the Criteria</h3>
                    <p className="leading-relaxed">It requires:</p>
                    <ul className="list-inside list-disc space-y-2">
                        <li>
                            <strong>Generating complex objects:</strong> Multi-step synthetic pathways, not scalar
                            predictions
                        </li>
                        <li>
                            <strong>Adherence to grammar:</strong> Reaction rules, chemical validity constraints,
                            stereochemistry
                        </li>
                        <li>
                            <strong>Deep chemical understanding:</strong> Reaction mechanisms, functional group
                            compatibility, protecting group strategies, reagent selection
                        </li>
                    </ul>
                </div>
            </div>

            <p className="leading-relaxed font-medium">
                A model that masters multi-step retrosynthesis must internalize a rich representation of chemical space.
                It must learn which transformations are feasible, which sequences are efficient, and which structural
                motifs require protection or activation.
            </p>

            <p className="leading-relaxed">
                This knowledge is transferable. A model capable of planning complex syntheses should, in principle,
                excel at forward prediction, reaction condition optimization, and property prediction—just as GPT excels
                at sentiment analysis without explicit training.
            </p>

            <div className="border-muted border-l-4 py-2 pl-6">
                <p className="text-lg font-medium italic">
                    Retrosynthesis may be chemistry&apos;s pre-training task—the structural problem whose mastery
                    unlocks downstream capabilities.
                </p>
            </div>
        </section>
    )
}
