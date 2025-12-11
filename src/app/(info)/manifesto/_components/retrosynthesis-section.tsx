export function RetrosynthesisSection() {
    return (
        <section className="space-y-6">
            <h2 className="text-2xl font-bold">Retrosynthesis as the Structural Challenge</h2>

            <p className="leading-relaxed">
                What is chemistry&apos;s equivalent to language modeling or protein structure prediction? We contend
                it&apos;s retrosynthesis: designing multi-step synthetic pathways to molecules of interest. It checks
                all the criteria: it requires generating complex objects (synthetic routes), adherence to grammar
                (reaction rules, stereochemistry, chemical validity), and deep chemical understanding (mechanisms,
                functional group compatibility, protecting group strategies).
            </p>

            <p className="leading-relaxed">
                A model that masters multi-step retrosynthesis must internalize a rich representation of chemical space.
                It must learn which transformations are feasible, which sequences are efficient, and which structural
                motifs require protection or activation. This knowledge is transferable: a model capable of planning
                complex syntheses should excel at forward prediction, reaction condition optimization, and property
                prediction&mdash;just as GPT excels at sentiment analysis without explicit training.
            </p>

            <div className="border-primary border-l-4 py-2 pl-6">
                <p className="font-medium italic">
                    Retrosynthesis may be chemistry&apos;s pre-training task&mdash;the structural problem whose mastery
                    unlocks downstream capabilities.
                </p>
            </div>
        </section>
    )
}
