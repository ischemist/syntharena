import Link from 'next/link'

export function MeasurementSection() {
    return (
        <section className="space-y-6">
            <h2 className="text-2xl font-bold">Why We Cannot Answer &ldquo;Which Model Is Best&rdquo;</h2>

            <p className="leading-relaxed">
                If retrosynthesis is the strategic challenge for chemistry AI, a natural question follows: Which of the
                existing models should we use?
            </p>

            <p className="leading-relaxed">
                This question is currently unanswerable. Not because the models are similar, but because we lack the
                infrastructure to compare them. Three fundamental barriers prevent rigorous model comparison.
            </p>

            <p className="leading-relaxed">
                <strong>1. The Babel of Formats:</strong> Different tools output fundamentally incompatible data
                structures (bipartite graphs, precursor maps, nested dictionaries, node-edge lists, linear recipe
                strings). Comparative analysis requires writing bespoke parsers for every model.
            </p>

            <div className="space-y-2">
                <p className="leading-relaxed">
                    <strong>2. Stock Set Chaos:</strong> The definition of a &ldquo;solved&rdquo; route depends on which
                    molecules are considered available. Stock sets vary by over{' '}
                    <strong>three orders of magnitude</strong>:
                </p>
                <div className="bg-muted/50 space-y-1 rounded p-4 text-sm">
                    <div className="flex justify-between">
                        <span>Curated catalogs (Enamine, MolPort):</span>
                        <span className="font-mono">~300k compounds</span>
                    </div>
                    <div className="flex justify-between">
                        <span>eMolecules made-to-order virtual library:</span>
                        <span className="font-mono">~230M compounds</span>
                    </div>
                    <div className="flex justify-between font-semibold">
                        <span>Variance:</span>
                        <span className="font-mono">~1000×</span>
                    </div>
                </div>
                <p className="leading-relaxed">
                    A reported 99% Solv-0[virtual stock] (legacy STR) against a 230M made-to-order library and 30%
                    Solv-0[off-the-shelf stock] against a 300k catalog measure different task predicates. They are not
                    comparable estimates of one stock-independent model capability.
                </p>
            </div>

            <p className="leading-relaxed">
                <strong>3. Validity Blindness:</strong> Legacy stock-termination rate (STR) combines syntactically valid
                route records with a leaf-stock constraint—the evidence now named Solv-0[stock]. It provides{' '}
                <em>no guarantee</em> that the reaction topology is legal or that intermediate transformations are
                chemically feasible.
            </p>

            <p className="text-muted-foreground text-sm">
                For detailed examples of chemically invalid &ldquo;solved&rdquo; routes, see{' '}
                <Link
                    href="https://arxiv.org/abs/2512.07079"
                    className="hover:text-foreground underline"
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    Figure 2 in the paper
                </Link>
                . Interactive versions are available on SynthArena:{' '}
                <Link
                    href="/benchmarks/uspto-190/targets/sa_56cc64f92df872fda43139dd?mode=pred-vs-pred&model1=sa_dca88fc7fb96052aac42ec72&rank1=1&model2=sa_314de306d2f2844f9984866d&rank2=1"
                    className="hover:text-foreground underline"
                >
                    USPTO-082
                </Link>
                ,{' '}
                <Link
                    href="/runs/sa_dca88fc7fb96052aac42ec72?target=sa_1e63fe124e8a7dd3fd0dfc27&rank=1"
                    className="hover:text-foreground underline"
                >
                    USPTO-114
                </Link>
                ,{' '}
                <Link
                    href="/runs/sa_dca88fc7fb96052aac42ec72?target=sa_4337ccdb9d8f2e9841da602e&rank=1"
                    className="hover:text-foreground underline"
                >
                    USPTO-169
                </Link>
                ,{' '}
                <Link
                    href="/runs/sa_dca88fc7fb96052aac42ec72?target=sa_f5edbc0c6d65391770a313c9&rank=1"
                    className="hover:text-foreground underline"
                >
                    USPTO-93
                </Link>
                ,{' '}
                <Link
                    href="/runs/sa_dca88fc7fb96052aac42ec72?target=sa_b6247430f110c121808e234d&rank=1"
                    className="hover:text-foreground underline"
                >
                    USPTO-16
                </Link>
                ,{' '}
                <Link
                    href="/runs/sa_dca88fc7fb96052aac42ec72?target=sa_b671af3b83911a9d94c23e0c&rank=1"
                    className="hover:text-foreground underline"
                >
                    USPTO-181
                </Link>
                .
            </p>
        </section>
    )
}
