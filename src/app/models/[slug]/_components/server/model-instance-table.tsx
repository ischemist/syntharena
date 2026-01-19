import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'

import type { ModelInstanceListItem } from '@/types'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

interface ModelInstanceTableProps {
    instances: ModelInstanceListItem[]
}

/**
 * Formats a semantic version from its components.
 */
function formatVersion(instance: ModelInstanceListItem): string {
    const base = `v${instance.versionMajor}.${instance.versionMinor}.${instance.versionPatch}`
    return instance.versionPrerelease ? `${base}-${instance.versionPrerelease}` : base
}

/**
 * Server component displaying a table of model instance versions.
 * Shows version, name, description, run count, and date added.
 */
export function ModelInstanceTable({ instances }: ModelInstanceTableProps) {
    if (instances.length === 0) {
        return (
            <div className="space-y-4">
                <h2 className="text-xl font-semibold">Model Versions</h2>
                <div className="text-muted-foreground py-8 text-center">
                    <p>No model versions found for this algorithm.</p>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-4">
            <h2 className="text-xl font-semibold">Model Versions</h2>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Version</TableHead>
                        <TableHead>Instance Name</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="text-right">Prediction Runs</TableHead>
                        <TableHead className="text-right">Date Added</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {instances.map((instance) => (
                        <TableRow key={instance.id} className="group hover:bg-muted/50 relative transition-colors">
                            <TableCell>
                                <code className="bg-muted rounded px-1.5 py-0.5 text-sm">
                                    {formatVersion(instance)}
                                </code>
                            </TableCell>
                            <TableCell className="font-medium">
                                <Link
                                    href={`/instances/${instance.slug}`}
                                    className="focus:ring-primary rounded-sm outline-none after:absolute after:inset-0 focus:ring-2"
                                    prefetch={true}
                                >
                                    {instance.name}
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
        </div>
    )
}
