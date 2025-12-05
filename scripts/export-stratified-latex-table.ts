import './env-loader'

import prisma from '@/lib/db'

// Mapping from database model names to readable display names
const MODEL_NAME_MAPPING: Record<string, string> = {
    'dms-explorer-xl': 'DMS Explorer XL',
    'aizynthfinder-mcts': 'AiZynF MCTS',
    'aizynthfinder-mcts-high': 'AiZynF MCTS (High)',
    'retro-star': 'Retro*',
    'retro-star-high': 'Retro* (High)',
    'aizynthfinder-retro-star': 'AiZynF Retro*',
    'aizynthfinder-retro-star-high': 'AiZynF Retro* (High)',
    'syntheseus-retro0-local-retro': 'Syntheseus LocalRetro',
    askcos: 'ASKCOS',
    'synplanner-eval': 'SynPlanner Eval',
    'synplanner-mcts': 'SynPlanner MCTS',
}

async function exportStratifiedLatexTable(
    benchmarkId: string,
    includeTime: boolean,
    includeTimeRelative: boolean,
    includeCost: boolean,
    noCi: boolean
) {
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
            benchmarkSet: {
                include: {
                    _count: {
                        select: { targets: true },
                    },
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

    // Build format string based on flags
    let formatStr = noCi
        ? '% Format: Model & L1 & L2 & L3 & L4 & L5'
        : '% Format: Model & L1 & L1_lower & L1_upper & L2 & L2_lower & L2_upper & L3 & L3_lower & L3_upper & L4 & L4_lower & L4_upper & L5 & L5_lower & L5_upper'
    if (includeTime) {
        formatStr += ' & Duration'
    }
    if (includeTimeRelative) {
        formatStr += ' & Time/Target'
    }
    if (includeCost) {
        formatStr += ' & Cost'
    }
    formatStr += ' \\\\'

    console.log('% LaTeX table for stratified Top-10 accuracy (by route length)')
    console.log('% Benchmark:', benchmarkId)
    console.log(formatStr)
    console.log()

    // Define route lengths to include
    const routeLengths = [2, 3, 4, 5]

    for (const stat of statistics) {
        const dbModelName = stat.predictionRun.modelInstance.name
        const modelName = MODEL_NAME_MAPPING[dbModelName] || dbModelName

        // Convert to percentages and format to 1 decimal place
        const formatMetric = (value: number) => (value * 100).toFixed(1)

        const values: string[] = [modelName]

        // For each route length, find the corresponding metric
        for (const length of routeLengths) {
            const metric = stat.metrics.find((m) => m.groupKey === length)

            if (metric) {
                if (noCi) {
                    values.push(formatMetric(metric.value))
                } else {
                    values.push(formatMetric(metric.value), formatMetric(metric.ciLower), formatMetric(metric.ciUpper))
                }
            } else {
                // No data for this route length
                if (noCi) {
                    values.push('--')
                } else {
                    values.push('--', '--', '--')
                }
            }
        }

        // Add optional columns
        if (includeTime) {
            const duration = stat.totalWallTime ? (stat.totalWallTime / 60).toFixed(1) : '--'
            values.push(duration)
        }

        if (includeTimeRelative) {
            const targetCount = stat.benchmarkSet._count.targets
            const timePerTarget =
                stat.totalWallTime && targetCount > 0 ? (stat.totalWallTime / targetCount).toFixed(1) : '--'
            values.push(timePerTarget)
        }

        if (includeCost) {
            const cost = stat.predictionRun.totalCost ? stat.predictionRun.totalCost.toFixed(2) : '--'
            values.push(cost)
        }

        // Output LaTeX row
        console.log(`${values.join(' & ')} \\\\`)
    }
}

// Parse command-line arguments
function parseArgs() {
    const args = process.argv.slice(2)
    let benchmarkId: string | null = null
    let includeTime = false
    let includeTimeRelative = false
    let includeCost = false
    let noCi = false

    for (const arg of args) {
        if (arg === '-t') {
            includeTime = true
        } else if (arg === '-trel') {
            includeTimeRelative = true
        } else if (arg === '-c') {
            includeCost = true
        } else if (arg === '-noci') {
            noCi = true
        } else if (!arg.startsWith('-')) {
            benchmarkId = arg
        }
    }

    return { benchmarkId, includeTime, includeTimeRelative, includeCost, noCi }
}

// Main execution
const { benchmarkId, includeTime, includeTimeRelative, includeCost, noCi } = parseArgs()

if (!benchmarkId) {
    console.error('Usage: pnpm tsx scripts/export-stratified-latex-table.ts <benchmarkId> [-t] [-trel] [-c] [-noci]')
    console.error('  -t     Include total wall time (minutes)')
    console.error('  -trel  Include wall time per target (seconds/target)')
    console.error('  -c     Include total cost (USD)')
    console.error('  -noci  Show only actual values (no confidence intervals)')
    process.exit(1)
}

exportStratifiedLatexTable(benchmarkId, includeTime, includeTimeRelative, includeCost, noCi)
    .catch((e) => {
        console.error('Error:', e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
