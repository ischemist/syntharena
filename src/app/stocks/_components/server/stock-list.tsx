import Link from 'next/link'

import * as stockService from '@/lib/services/stock.service'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

/**
 * Server component that displays all available stocks with their molecule counts.
 * Each stock card is clickable and navigates to the stock detail page.
 */
export async function StockList() {
    const stocks = await stockService.getStocks()

    if (stocks.length === 0) {
        return (
            <Card>
                <CardContent className="text-muted-foreground py-8 text-center">
                    No stocks available. Load a stock using the CLI script.
                </CardContent>
            </Card>
        )
    }

    return (
        <div className="space-y-4">
            {stocks.map((stock) => (
                <Link key={stock.id} href={`/stocks/${stock.id}`}>
                    <Card className="hover:bg-accent transition-colors">
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <CardTitle>{stock.name}</CardTitle>
                                <Badge variant="secondary">{stock.itemCount.toLocaleString()} molecules</Badge>
                            </div>
                            {stock.description && <CardDescription>{stock.description}</CardDescription>}
                        </CardHeader>
                    </Card>
                </Link>
            ))}
        </div>
    )
}
