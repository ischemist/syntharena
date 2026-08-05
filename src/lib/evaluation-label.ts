export function parseEvaluationLabelOption(args: string[]): {
    evaluationLabel: string | undefined
    remainingArgs: string[]
} {
    let evaluationLabel: string | undefined
    const remainingArgs: string[] = []

    for (let index = 0; index < args.length; index += 1) {
        const arg = args[index]
        if (arg === '--evaluation-label') {
            const value = args[index + 1]
            if (!value) throw new Error('--evaluation-label requires a value.')
            if (evaluationLabel !== undefined) throw new Error('--evaluation-label may only be specified once.')
            evaluationLabel = value
            index += 1
        } else if (arg.startsWith('--evaluation-label=')) {
            const value = arg.slice('--evaluation-label='.length)
            if (!value) throw new Error('--evaluation-label requires a value.')
            if (evaluationLabel !== undefined) throw new Error('--evaluation-label may only be specified once.')
            evaluationLabel = value
        } else {
            remainingArgs.push(arg)
        }
    }

    return { evaluationLabel, remainingArgs }
}

export function resolveEvaluationLabel(
    requestedLabel: string | undefined,
    availableLabels: string[],
    benchmarkId: string
): string {
    const labels = [...new Set(availableLabels)].toSorted()

    if (requestedLabel !== undefined) {
        if (labels.includes(requestedLabel)) return requestedLabel
        const available = labels.length > 0 ? labels.join(', ') : 'none'
        throw new Error(
            `Evaluation label "${requestedLabel}" is not available for benchmark "${benchmarkId}". Available labels: ${available}.`
        )
    }

    if (labels.length === 0) throw new Error(`No evaluations found for benchmark "${benchmarkId}".`)
    if (labels.length === 1) return labels[0]
    throw new Error(
        `Benchmark "${benchmarkId}" has multiple evaluation labels (${labels.join(', ')}). Pass --evaluation-label <label> to export one exact evaluation context.`
    )
}
