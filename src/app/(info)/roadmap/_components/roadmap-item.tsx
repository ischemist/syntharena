interface RoadmapItemProps {
    text: string
}

export function RoadmapItem({ text }: RoadmapItemProps) {
    return (
        <li className="text-muted-foreground relative pl-6 before:absolute before:top-0 before:left-0 before:content-['-']">
            <span className="leading-snug">{text}</span>
        </li>
    )
}
