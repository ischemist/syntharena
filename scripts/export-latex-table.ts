import './env-loader'

import prisma from '@/lib/db'

async function exportLatexTable(benchmarkId: string) {
    // Fetch statistics for the benchmark
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
                    groupKey: null, // Only overall metrics
                    metricName: {
                        in: ['Solvability', 'Top-1', 'Top-10'],
                    },
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

    console.log('% LaTeX table for benchmark:', benchmarkId)
    console.log(
        '% Format: Model & Solv & Solv_lower & Solv_upper & Top-1 & Top-1_lower & Top-1_upper & Top-10 & Top-10_lower & Top-10_upper \\\\'
    )
    console.log()

    for (const stat of statistics) {
        const modelName = stat.predictionRun.modelInstance.name

        // Find metrics
        const solvability = stat.metrics.find((m) => m.metricName === 'Solvability')
        const top1 = stat.metrics.find((m) => m.metricName === 'Top-1')
        const top10 = stat.metrics.find((m) => m.metricName === 'Top-10')

        if (!solvability) {
            console.error(`Warning: No solvability metric found for model ${modelName}`)
            continue
        }

        // Convert to percentages and format to 1 decimal place
        const formatMetric = (value: number) => (value * 100).toFixed(1)

        const solvValues = [
            formatMetric(solvability.value),
            formatMetric(solvability.ciLower),
            formatMetric(solvability.ciUpper),
        ]

        const top1Values = top1
            ? [formatMetric(top1.value), formatMetric(top1.ciLower), formatMetric(top1.ciUpper)]
            : ['--', '--', '--']

        const top10Values = top10
            ? [formatMetric(top10.value), formatMetric(top10.ciLower), formatMetric(top10.ciUpper)]
            : ['--', '--', '--']

        // Output LaTeX row
        const row = [modelName, ...solvValues, ...top1Values, ...top10Values].join(' & ')
        console.log(`${row} \\\\`)
    }
}

// Main execution
const benchmarkId = process.argv[2] || 'cmiqphf550000baddsv4me1iy'

exportLatexTable(benchmarkId)
    .catch((e) => {
        console.error('Error:', e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
