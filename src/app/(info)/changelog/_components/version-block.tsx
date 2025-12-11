import { ChangeType, ChangeTypeBadge } from './change-type-badge'

interface Change {
    type: ChangeType
    description: string
}

interface VersionBlockProps {
    version: string
    date: string
    changes: Change[]
}

export function VersionBlock({ version, date, changes }: VersionBlockProps) {
    return (
        <section className="border-b pb-6 last:border-b-0">
            <div className="mb-4">
                <h2 className="text-2xl font-semibold">
                    {version} <span className="text-muted-foreground ml-2 text-base font-normal">({date})</span>
                </h2>
            </div>
            <ul className="space-y-2">
                {changes.map((change, index) => (
                    <li key={index} className="flex items-start gap-3">
                        <ChangeTypeBadge type={change.type} className="mt-0.5" />
                        <span className="flex-1 leading-relaxed">{change.description}</span>
                    </li>
                ))}
            </ul>
        </section>
    )
}

export { ChangeType }
export type { Change }
