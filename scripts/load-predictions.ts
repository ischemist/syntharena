import './env-loader'

import { loadEvaluationBundleForImport } from '@ischemist/retrocast-io'

import prisma from '@/lib/db'
import {
    createOrUpdatePredictionRun,
    importEvaluationBundle,
    updatePredictionRunCost,
} from '@/lib/services/loaders/prediction-loader.service'

type Args = {
    bundleDir: string
    benchmark: string
    model: string
    hourlyCost?: number
}

function usage(): never {
    throw new Error(
        'Usage: pnpm tsx scripts/load-predictions.ts --bundle <evaluate-v2-dir> --benchmark <id-or-name> --model <id-or-slug> [--hourly-cost <usd>]'
    )
}

function parseArgs(argv: string[]): Args {
    const values = new Map<string, string>()
    for (let index = 0; index < argv.length; index += 2) {
        const key = argv[index]
        const value = argv[index + 1]
        if (!key?.startsWith('--') || value === undefined) usage()
        values.set(key, value)
    }
    const bundleDir = values.get('--bundle')
    const benchmark = values.get('--benchmark')
    const model = values.get('--model')
    if (!bundleDir || !benchmark || !model) usage()
    const hourlyCostValue = values.get('--hourly-cost')
    const hourlyCost = hourlyCostValue === undefined ? undefined : Number(hourlyCostValue)
    if (hourlyCost !== undefined && (!Number.isFinite(hourlyCost) || hourlyCost < 0)) {
        throw new Error('--hourly-cost must be a non-negative number')
    }
    return { bundleDir, benchmark, model, hourlyCost }
}

async function main(): Promise<void> {
    const args = parseArgs(process.argv.slice(2))
    const startedAt = performance.now()
    console.log(`Verifying RetroCast bundle: ${args.bundleDir}`)
    const bundle = await loadEvaluationBundleForImport(args.bundleDir, { verification: 'outputs-and-sources' })

    const [benchmark, model] = await Promise.all([
        prisma.benchmarkSet.findFirst({ where: { OR: [{ id: args.benchmark }, { name: args.benchmark }] } }),
        prisma.modelInstance.findFirst({ where: { OR: [{ id: args.model }, { slug: args.model }] } }),
    ])
    if (!benchmark) throw new Error(`Benchmark not found: ${args.benchmark}`)
    if (!model) throw new Error(`Model instance not found: ${args.model}`)
    if (bundle.evaluation.task.name !== benchmark.name) {
        throw new Error(`Bundle task ${bundle.evaluation.task.name} does not match benchmark ${benchmark.name}`)
    }

    const run = await createOrUpdatePredictionRun(benchmark.id, model.id, {
        retrocastVersion: bundle.manifest.retrocast_version,
        commandParams: bundle.manifest.parameters,
        executedAt: new Date(bundle.manifest.created_at),
        hourlyCost: args.hourlyCost,
    })
    const result = await importEvaluationBundle(run.id, bundle)
    await updatePredictionRunCost(run.id)

    const seconds = (performance.now() - startedAt) / 1000
    console.log(
        `Imported ${result.candidates} candidates (${result.routes} routes, ${result.failures} failures) and ${result.metrics} metric estimates in ${seconds.toFixed(1)}s.`
    )
}

main()
    .catch((error: unknown) => {
        console.error(error instanceof Error ? error.message : error)
        process.exitCode = 1
    })
    .finally(async () => prisma.$disconnect())
