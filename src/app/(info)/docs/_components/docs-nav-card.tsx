import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'

import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface DocsNavCardProps {
    title: string
    description: string
    href: string
    icon: LucideIcon
}

export function DocsNavCard({ title, description, href, icon: Icon }: DocsNavCardProps) {
    return (
        <Link href={href} className="block transition-transform hover:scale-[1.02]">
            <Card className="hover:border-primary h-full">
                <CardHeader>
                    <div className="mb-2 flex items-center gap-2">
                        <div className="bg-primary/10 text-primary flex size-10 items-center justify-center rounded-lg">
                            <Icon className="size-5" />
                        </div>
                    </div>
                    <CardTitle className="text-xl">{title}</CardTitle>
                    <CardDescription className="text-base">{description}</CardDescription>
                </CardHeader>
            </Card>
        </Link>
    )
}
