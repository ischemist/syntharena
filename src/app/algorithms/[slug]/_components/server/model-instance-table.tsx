import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'

import type { ModelInstanceListItem } from '@/types'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

interface ModelInstanceTableProps {
    instances: ModelInstanceListItem[]
}

function formatVersion(instance: ModelInstanceListItem): string {
    const base = `v${instance.versionMajor}.${instance.versionMinor}.${instance.versionPatch}`
    return instance.versionPrerelease ? `${base}-${instance.versionPrerelease}` : base
}

export function ModelInstanceTable({ instances }: ModelInstanceTableProps) {
    if (instances.length === 0) {
        // this component now assumes it's inside a family section,
        // so the "not found" message is more specific.
        return (
            <div className="text-muted-foreground border-t border-b py-4 text-sm">
                <p>no model versions found for this family.</p>
            </div>
        )
    }

    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>version</TableHead>
                    <TableHead>slug</TableHead>
                    <TableHead>description</TableHead>
                    <TableHead className="text-right">prediction runs</TableHead>
                    <TableHead className="text-right">date added</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {instances.map((instance) => (
                    <TableRow key={instance.id} className="group hover:bg-muted/50 relative transition-colors">
                        <TableCell>
                            <code className="bg-muted rounded px-1.5 py-0.5 text-sm">{formatVersion(instance)}</code>
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                            <Link
                                href={`/models/${instance.slug}`}
                                className="focus:ring-primary rounded-sm outline-none after:absolute after:inset-0 focus:ring-2"
                                prefetch={true}
                            >
                                {/* display slug instead of non-existent name */}
                                {instance.slug}
                            </Link>
                        </TableCell>
                        <TableCell className="text-muted-foreground max-w-md truncate">
                            {instance.description || '—'}
                        </TableCell>
                        <TableCell className="text-right">
                            <Badge variant="secondary">
                                {instance.runCount} {instance.runCount === 1 ? 'run' : 'runs'}
                            </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-right text-sm">
                            {formatDistanceToNow(instance.createdAt, { addSuffix: true })}
                        </TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    )
}
