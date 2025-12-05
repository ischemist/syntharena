import './env-loader'

import prisma from '@/lib/db'

async function exportStratifiedLatexTable(benchmarkId: string) {
    // Fetch statistics with stratified metrics for the benchmark
    const statistics = await prisma.modelRunStatistics.findMany({
        where: {
            predictionRun: {
                benchmarkSetId: benchmarkId,
            },
        },
        include: {
            predictionRun: {
                include: {
                    modelInstance: true,
                },
            },
            metrics: {
                where: {
                    metricName: 'Top-10',
                    groupKey: { not: null }, // Only stratified metrics
                },
            },
        },
        orderBy: {
            predictionRun: {
                modelInstance: {
                    name: 'asc',
                },
            },
        },
    })

    console.log('% LaTeX table for stratified Top-10 accuracy (by route length)')
    console.log('% Benchmark:', benchmarkId)
    console.log(
        '% Format: Model & L1 & L1_lower & L1_upper & L2 & L2_lower & L2_upper & L3 & L3_lower & L3_upper & L4 & L4_lower & L4_upper & L5 & L5_lower & L5_upper \\\\'
    )
    console.log()

    // Define route lengths to include
    const routeLengths = [1, 2, 3, 4, 5]

    for (const stat of statistics) {
        const modelName = stat.predictionRun.modelInstance.name

        // Convert to percentages and format to 1 decimal place
        const formatMetric = (value: number) => (value * 100).toFixed(1)

        const values: string[] = [modelName]

        // For each route length, find the corresponding metric
        for (const length of routeLengths) {
            const metric = stat.metrics.find((m) => m.groupKey === length)

            if (metric) {
                values.push(formatMetric(metric.value), formatMetric(metric.ciLower), formatMetric(metric.ciUpper))
            } else {
                // No data for this route length
                values.push('--', '--', '--')
            }
        }

        // Output LaTeX row
        console.log(`${values.join(' & ')} \\\\`)
    }
}

// Main execution
const benchmarkId = process.argv[2] || 'cmiqphzrc0000d4ddpepswpt7'

exportStratifiedLatexTable(benchmarkId)
    .catch((e) => {
        console.error('Error:', e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
