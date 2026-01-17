import { getStockById } from '@/lib/services/view/stock.view'
import { BreadcrumbShell } from '@/components/breadcrumb-shell'

export default async function StockDetailBreadcrumb({ params }: { params: Promise<{ stockId: string }> }) {
    const { stockId } = await params
    const stock = await getStockById(stockId) // cached by react cache/prisma

    return <BreadcrumbShell items={[{ label: 'Stocks', href: '/stocks' }, { label: stock.name }]} />
}
