import { Activity, Mail } from 'lucide-react'

import { Button } from '@/components/ui/button'

export function IschemistUpdatesSection() {
    return (
        <section className="border-t py-8">
            <div className="max-w-xl space-y-4">
                <div className="space-y-2">
                    <p className="text-foreground text-xs font-medium tracking-wide uppercase">
                        From isChemist: Structure precedes quantity.
                    </p>
                    <p className="text-muted-foreground text-sm leading-relaxed">
                        Essays and software that make better scientific questions possible.
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Button asChild size="sm">
                        <a href="https://ischemist.com/newsletter" target="_blank" rel="noopener noreferrer">
                            <Mail className="size-4" />
                            Newsletter
                        </a>
                    </Button>
                    <Button asChild variant="outline" size="sm">
                        <a href="https://status.ischemist.com" target="_blank" rel="noopener noreferrer">
                            <Activity className="size-4" />
                            Service status
                        </a>
                    </Button>
                </div>
            </div>
        </section>
    )
}
