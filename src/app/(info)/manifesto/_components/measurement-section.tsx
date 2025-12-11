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
                    A model reporting 99% solvability against a 230M made-to-order virtual library and another reporting
                    30% against a 300k off-the-shelf catalog are incomparable. The metric conflates model capability
                    with stock definition.
                </p>
            </div>

            <p className="leading-relaxed">
                <strong>3. Validity Blindness:</strong> The dominant metric (stock-termination rate, STR) validates only
                that a route&apos;s terminal nodes exist in commercial stock. It provides <em>no guarantee</em> that
                intermediate transformations are chemically feasible.
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
                    href="/benchmarks/cmisbzsr30000xvdd613ymmbx/targets/cmisbzt2900y4xvddbnu3q2k5?mode=pred-vs-pred&model1=cmise2ax00000qsddkfge5au3&rank1=1&model2=cmisdw7p10000ceddz6l01zhq&rank2=1"
                    className="hover:text-foreground underline"
                >
                    USPTO-082
                </Link>
                ,{' '}
                <Link
                    href="/runs/cmise2ax00000qsddkfge5au3?stock=qhi67k3yqgqhrx49sc3akbih&target=cmisbzt5j01bwxvddy4a5xpu2&rank=1&search=114"
                    className="hover:text-foreground underline"
                >
                    USPTO-114
                </Link>
                ,{' '}
                <Link
                    href="/runs/cmise2ax00000qsddkfge5au3?stock=qhi67k3yqgqhrx49sc3akbih&target=cmisbztag020hxvdd8nl7zg94&rank=1&search=169"
                    className="hover:text-foreground underline"
                >
                    USPTO-169
                </Link>
                ,{' '}
                <Link
                    href="/runs/cmise2ax00000qsddkfge5au3?stock=qhi67k3yqgqhrx49sc3akbih&target=cmisbzt3h0139xvddt5rm50se&rank=1&search=93"
                    className="hover:text-foreground underline"
                >
                    USPTO-93
                </Link>
                ,{' '}
                <Link
                    href="/runs/cmise2ax00000qsddkfge5au3?stock=qhi67k3yqgqhrx49sc3akbih&target=cmisbzsv10066xvddmu0bi5nk&rank=1&search=16"
                    className="hover:text-foreground underline"
                >
                    USPTO-16
                </Link>
                ,{' '}
                <Link
                    href="/runs/cmise2ax00000qsddkfge5au3?stock=qhi67k3yqgqhrx49sc3akbih&target=cmisbztbj025gxvddwrx3reh6&rank=1&search=181"
                    className="hover:text-foreground underline"
                >
                    USPTO-181
                </Link>
                .
            </p>
        </section>
    )
}
