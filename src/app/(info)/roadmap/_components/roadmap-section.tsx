import { RoadmapItem } from './roadmap-item'

interface RoadmapSectionProps {
    title: string
    subtitle: string
    items: string[]
}

export function RoadmapSection({ title, subtitle, items }: RoadmapSectionProps) {
    return (
        <section className="border-b pb-8 last:border-b-0">
            <div className="mb-6">
                <h2 className="mb-1 text-2xl font-semibold">{title}</h2>
                <p className="text-muted-foreground text-sm">{subtitle}</p>
            </div>
            <ul className="space-y-1">
                {items.map((item, index) => (
                    <RoadmapItem key={index} text={item} />
                ))}
            </ul>
        </section>
    )
}
