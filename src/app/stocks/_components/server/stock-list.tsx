import Link from 'next/link'

import * as stockService from '@/lib/services/stock.service'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

/**
 * Server component that displays all available stocks with their molecule counts.
 * Each stock row is clickable and navigates to the stock detail page.
 */
export async function StockList() {
    const stocks = await stockService.getStocks()

    if (stocks.length === 0) {
        return (
            <div className="text-muted-foreground py-12 text-center">
                <p>No stocks available. Load a stock using the CLI script.</p>
            </div>
        )
    }

    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Molecules</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {stocks.map((stock) => (
                    <TableRow key={stock.id} className="cursor-pointer">
                        <Link href={`/stocks/${stock.id}`} prefetch={true} className="contents">
                            <TableCell className="font-semibold">{stock.name}</TableCell>
                            <TableCell className="text-muted-foreground">{stock.description || '—'}</TableCell>
                            <TableCell className="text-right">
                                <Badge variant="secondary">{stock.itemCount.toLocaleString()}</Badge>
                            </TableCell>
                        </Link>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    )
}
