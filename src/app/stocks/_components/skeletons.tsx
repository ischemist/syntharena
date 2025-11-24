import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

/**
 * Loading skeleton for the stock list view.
 * Shows placeholder cards for stocks while data is loading.
 * Optimized for minimal CLS with consistent spacing.
 */
export function StockListSkeleton() {
    return (
        <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
                <Card key={i} className="hover:bg-accent my-4 transition-colors">
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <Skeleton className="h-6 w-48" />
                            <Skeleton className="h-6 w-24 rounded-full" /> {/* Badge placeholder */}
                        </div>
                        <Skeleton className="mt-2 h-4 w-full" />
                    </CardHeader>
                </Card>
            ))}
        </div>
    )
}

/**
 * Loading skeleton for the molecule grid view.
 * Shows placeholder molecule cards while search results are loading.
 */
export function MoleculeGridSkeleton() {
    return (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
                <Card key={i}>
                    <CardHeader>
                        <Skeleton className="h-[200px] w-full" />
                    </CardHeader>
                    <CardContent className="space-y-2">
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-3/4" />
                    </CardContent>
                </Card>
            ))}
        </div>
    )
}

/**
 * Loading skeleton for the molecule table view.
 * Shows placeholder table rows while search results are loading.
 */
export function MoleculeTableSkeleton() {
    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Structure</TableHead>
                    <TableHead>SMILES</TableHead>
                    <TableHead>InChiKey</TableHead>
                    <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                        <TableCell>
                            <Skeleton className="h-[100px] w-[100px]" />
                        </TableCell>
                        <TableCell>
                            <Skeleton className="h-4 w-full" />
                        </TableCell>
                        <TableCell>
                            <Skeleton className="h-4 w-full" />
                        </TableCell>
                        <TableCell>
                            <Skeleton className="h-8 w-20" />
                        </TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    )
}

/**
 * Loading skeleton for stock detail header.
 * Matches exact layout of StockDetailPage header to minimize CLS.
 */
export function StockDetailHeaderSkeleton() {
    return (
        <div className="space-y-4">
            {/* Back button */}
            <Skeleton className="h-9 w-40" />

            {/* Title and badge */}
            <div className="space-y-2">
                <div className="flex items-center gap-3">
                    <Skeleton className="h-9 w-64" /> {/* Title */}
                    <Skeleton className="h-6 w-32 rounded-full" /> {/* Badge */}
                </div>
                {/* Description line */}
                <Skeleton className="h-4 w-full max-w-2xl" />
            </div>
        </div>
    )
}

/**
 * Loading skeleton for the search interface.
 * Matches layout of MoleculeSearchBar + results.
 */
export function SearchInterfaceSkeleton() {
    return (
        <div className="space-y-4">
            {/* Search bar */}
            <div className="flex gap-2">
                <Skeleton className="h-10 flex-1" />
                <Skeleton className="h-10 w-24" />
            </div>

            {/* Results section */}
            <MoleculeGridSkeleton />
        </div>
    )
}

/**
 * Loading skeleton for stock details page.
 * Shows placeholder for stock header and search interface.
 */
export function StockDetailSkeleton() {
    return (
        <div className="space-y-6">
            <StockDetailHeaderSkeleton />
            <SearchInterfaceSkeleton />
        </div>
    )
}
