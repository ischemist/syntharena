export function Terminology() {
    const terms = [
        {
            term: 'Convergent Route',
            definition:
                'Contains at least one reaction combining ≥2 non-leaf molecules. Represents complex synthetic strategies where multiple intermediates are brought together.',
        },
        {
            term: 'Linear Route',
            definition: 'All reactions use at most one non-leaf molecule, representing sequential transformations.',
        },
        {
            term: 'Route Length',
            definition: 'The number of reaction steps in the synthesis route from target to starting materials.',
        },
        {
            term: 'Stock',
            definition:
                'The set of commercially available or defined starting materials that can be used as leaves in a synthesis route.',
        },
    ]

    return (
        <dl className="grid gap-4 sm:grid-cols-2">
            {terms.map(({ term, definition }) => (
                <div key={term} className="space-y-1">
                    <dt className="font-semibold">{term}</dt>
                    <dd className="text-muted-foreground text-sm">{definition}</dd>
                </div>
            ))}
        </dl>
    )
}
