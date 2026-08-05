'use client'

import { ColumnDef } from '@tanstack/react-table'

import type { MetricResult, StratifiedMetric } from '@/types'
import { DataTableColumnHeader } from '@/components/data-table-column-header'
import { MetricCell } from '@/components/metrics'

/**
 * Row data type for stratified metrics table.
 * Each row represents one model with metrics across different route lengths.
 */
export type StratifiedMetricRow = {
    modelName: string
    metricsByStratum: Record<string, MetricResult | undefined>
}

/**
 * Creates column definitions for stratified metrics tables.
 * Includes model name column and dynamic route length columns.
 *
 * @param routeLengths - Array of route lengths to create columns for (e.g., [1, 2, 3, 4])
 */
export function createStratifiedColumns(strata: string[]): ColumnDef<StratifiedMetricRow>[] {
    const columns: ColumnDef<StratifiedMetricRow>[] = [
        // Model Name Column
        {
            accessorKey: 'modelName',
            id: 'modelName',
            header: ({ column, table }) => <DataTableColumnHeader column={column} table={table} title="Model" />,
            cell: ({ row }) => <div className="font-medium">{row.getValue('modelName')}</div>,
        },
    ]

    // Add route length columns dynamically
    strata.forEach((stratum, idx) => {
        const isLastColumn = idx === strata.length - 1

        columns.push({
            id: `stratum-${stratum}`,
            accessorFn: (row) => row.metricsByStratum[stratum]?.value,
            header: ({ column, table }) => <DataTableColumnHeader column={column} table={table} title={stratum} />,
            cell: ({ row }) => {
                const metric = row.original.metricsByStratum[stratum]
                return (
                    <div className={isLastColumn ? 'flex justify-center' : 'flex justify-center'}>
                        {metric ? <MetricCell metric={metric} showBadge /> : '-'}
                    </div>
                )
            },
            sortingFn: (rowA, rowB) => {
                const a = rowA.original.metricsByStratum[stratum]?.value ?? -1
                const b = rowB.original.metricsByStratum[stratum]?.value ?? -1
                return a - b
            },
        })
    })

    return columns
}

/**
 * Transforms stratified metrics data into table rows.
 *
 * @param metricsMap - Map of model names to their stratified metrics
 * @param metricName - Name of the metric to extract (e.g., "Solv-0[stock]", "Top-1")
 */
export function transformStratifiedData(
    metricsMap: Map<
        string,
        {
            tier0Validity: StratifiedMetric
            solv0: StratifiedMetric
            topKAccuracy?: Record<string, StratifiedMetric>
        }
    >,
    metricName: string
): StratifiedMetricRow[] {
    return Array.from(metricsMap.entries()).map(([modelName, metrics]) => {
        let metricsByStratum: Record<string, MetricResult | undefined> = {}

        if (metricName === 'Tier-0 valid') {
            metricsByStratum = metrics.tier0Validity.byStratum
        } else if (metricName.startsWith('Solv-0[')) {
            metricsByStratum = metrics.solv0.byStratum
        } else {
            const topKMetric = metrics.topKAccuracy?.[metricName]
            if (topKMetric) metricsByStratum = topKMetric.byStratum
        }

        return {
            modelName,
            metricsByStratum,
        }
    })
}
