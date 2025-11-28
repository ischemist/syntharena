import Link from 'next/link'

import * as stockService from '@/lib/services/stock.service'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

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
                    <TableRow key={stock.id} className="group hover:bg-muted/50 relative transition-colors">
                        <TableCell className="font-semibold">
                            <Link
                                href={`/stocks/${stock.id}`}
                                className="focus:ring-primary rounded-sm outline-none after:absolute after:inset-0 focus:ring-2"
                                prefetch={true}
                            >
                                {stock.name}
                            </Link>
                        </TableCell>

                        <TableCell className="text-muted-foreground">{stock.description || '—'}</TableCell>

                        <TableCell className="text-right">
                            <Badge variant="secondary">{stock.itemCount.toLocaleString()}</Badge>
                        </TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    )
}
