import Link from 'next/link'

export function UpdatesSection() {
    return (
        <section className="border-t pt-8">
            <h2 className="mb-4 text-2xl font-semibold">Updates and Retractions</h2>

            <div className="text-muted-foreground space-y-3 text-sm">
                <p>
                    If a community audit reveals that a submitted model produced corrupted data (e.g., invalid SMILES
                    that bypassed the adapter checks due to a bug), we reserve the right to flag the entry as{' '}
                    <strong className="text-foreground">&ldquo;Disputed&rdquo;</strong> or remove it entirely.
                </p>

                <p>
                    To report issues with submitted models, please open an issue on the{' '}
                    <Link
                        href="https://github.com/ischemist/syntharena/issues"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-foreground underline hover:no-underline"
                    >
                        SynthArena GitHub repository
                    </Link>{' '}
                    with detailed evidence and analysis.
                </p>

                <p>
                    Model authors may submit updated results by following the same submission process. Previous versions
                    will be archived for transparency.
                </p>
            </div>
        </section>
    )
}
